import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("recommendations", () => {
  it("recommends books matching user favorite genres, excludes already-read", async () => {
    const t = convexTest(schema, modules);

    const { userId, locationId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", {
        clerkId: "user_rec1",
        phone: "+1234567890",
        name: "Genre Reader",
        roles: ["reader"],
        status: "active",
        reputationScore: 50,
        booksShared: 0,
        booksRead: 1,
        favoriteGenres: ["fiction", "mystery"],
      });
      const lid = await ctx.db.insert("partnerLocations", {
        name: "Test Library",
        address: "123 Main St",
        lat: 40.71,
        lng: -74.0,
        contactPhone: "+1111111111",
        operatingHours: {},
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 10,
        managedByUserId: uid,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
      return { userId: uid, locationId: lid };
    });

    await t.run(async (ctx) => {
      // Book already read — should be excluded
      const readBookId = await ctx.db.insert("books", {
        title: "Already Read",
        author: "Old Author",
        coverImage: "",
        description: "",
        categories: ["fiction"],
        pageCount: 200,
        language: "English",
        avgRating: 4.5,
        reviewCount: 10,
      });
      const readCopyId = await ctx.db.insert("copies", {
        bookId: readBookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
        currentLocationId: locationId,
      });
      await ctx.db.insert("journeyEntries", {
        copyId: readCopyId,
        readerId: userId,
        pickupLocationId: locationId,
        pickedUpAt: 1000000,
        returnedAt: 2000000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Fiction book (matches genre) with available copy — should rank high
      const fictionBookId = await ctx.db.insert("books", {
        title: "Great Mystery",
        author: "Mystery Author",
        coverImage: "https://example.com/mystery.jpg",
        description: "A thrilling mystery",
        categories: ["mystery", "fiction"],
        pageCount: 300,
        language: "English",
        avgRating: 4.2,
        reviewCount: 8,
      });
      await ctx.db.insert("copies", {
        bookId: fictionBookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
        currentLocationId: locationId,
      });

      // Science book (no genre match) — should rank lower
      await ctx.db.insert("books", {
        title: "Quantum Physics",
        author: "Science Author",
        coverImage: "https://example.com/science.jpg",
        description: "A science book",
        categories: ["science"],
        pageCount: 400,
        language: "English",
        avgRating: 4.8,
        reviewCount: 20,
      });

      // Another fiction book, no available copies — lower than available one
      await ctx.db.insert("books", {
        title: "Good Fiction",
        author: "Fiction Author",
        coverImage: "https://example.com/fiction.jpg",
        description: "A fiction book",
        categories: ["fiction"],
        pageCount: 250,
        language: "English",
        avgRating: 3.0,
        reviewCount: 2,
      });
    });

    const recs = await t.withIdentity({ subject: "user_rec1" }).query(api.recommendations.forMe, {});

    // Should not include "Already Read"
    expect(recs.find((r: { title: string }) => r.title === "Already Read")).toBeUndefined();

    // Should include the other three
    expect(recs).toHaveLength(3);

    // "Great Mystery" matches two genres + available → highest score
    expect(recs[0].title).toBe("Great Mystery");
    expect(recs[0].availableCopies).toBe(1);

    // "Good Fiction" matches one genre (fiction) but no copies available
    // "Quantum Physics" matches no genre but has high rating
    // Fiction genre match (+10) beats high rating alone (+4.8)
    expect(recs[1].title).toBe("Good Fiction");
    expect(recs[2].title).toBe("Quantum Physics");
  });

  it("falls back to highly-rated books when user has no favorite genres", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: "user_rec2",
        phone: "+1234567891",
        name: "New Reader",
        roles: ["reader"],
        status: "active",
        reputationScore: 50,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });

      const uid = await ctx.db.insert("users", {
        clerkId: "sharer",
        phone: "+9999999999",
        name: "Sharer",
        roles: ["reader"],
        status: "active",
        reputationScore: 50,
        booksShared: 2,
        booksRead: 0,
        favoriteGenres: [],
      });
      const lid = await ctx.db.insert("partnerLocations", {
        name: "Test Spot",
        address: "1 Test Rd",
        lat: 0,
        lng: 0,
        contactPhone: "+0000000000",
        operatingHours: {},
        photos: [],
        shelfCapacity: 10,
        currentBookCount: 2,
        managedByUserId: uid,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });

      // High-rated available book
      const bid1 = await ctx.db.insert("books", {
        title: "Top Rated",
        author: "Best Author",
        coverImage: "",
        description: "",
        categories: ["history"],
        pageCount: 200,
        language: "English",
        avgRating: 4.9,
        reviewCount: 50,
      });
      await ctx.db.insert("copies", {
        bookId: bid1,
        status: "available",
        condition: "like_new",
        ownershipType: "donated",
        originalSharerId: uid,
        qrCodeUrl: "",
        currentLocationId: lid,
      });

      // Low-rated book
      await ctx.db.insert("books", {
        title: "Low Rated",
        author: "Unknown",
        coverImage: "",
        description: "",
        categories: ["misc"],
        pageCount: 100,
        language: "English",
        avgRating: 1.0,
        reviewCount: 1,
      });
    });

    const recs = await t.withIdentity({ subject: "user_rec2" }).query(api.recommendations.forMe, {});

    expect(recs).toHaveLength(2);
    // With no genre prefs, available + high-rated wins
    expect(recs[0].title).toBe("Top Rated");
    expect(recs[1].title).toBe("Low Rated");
  });

  it("returns empty array for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const recs = await t.query(api.recommendations.forMe, {});
    expect(recs).toEqual([]);
  });
});

describe("recommendations.forBook", () => {
  async function seedBase(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      const sharer = await ctx.db.insert("users", {
        clerkId: "sharer_fb",
        phone: "+1000000000",
        name: "Sharer",
        roles: ["reader"],
        status: "active",
        reputationScore: 50,
        booksShared: 5,
        booksRead: 0,
        favoriteGenres: [],
      });
      const reader1 = await ctx.db.insert("users", {
        clerkId: "reader1_fb",
        phone: "+1000000001",
        name: "Reader One",
        roles: ["reader"],
        status: "active",
        reputationScore: 50,
        booksShared: 0,
        booksRead: 3,
        favoriteGenres: [],
      });
      const reader2 = await ctx.db.insert("users", {
        clerkId: "reader2_fb",
        phone: "+1000000002",
        name: "Reader Two",
        roles: ["reader"],
        status: "active",
        reputationScore: 50,
        booksShared: 0,
        booksRead: 3,
        favoriteGenres: [],
      });
      const location = await ctx.db.insert("partnerLocations", {
        name: "Test Library",
        address: "1 Book St",
        lat: 0,
        lng: 0,
        contactPhone: "+0000000000",
        operatingHours: {},
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 10,
        managedByUserId: sharer,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
      return { sharer, reader1, reader2, location };
    });
  }

  function makeBook(title: string, categories: string[] = ["fiction"]) {
    return {
      title,
      author: `Author of ${title}`,
      coverImage: "",
      description: "",
      categories,
      pageCount: 200,
      language: "English",
      avgRating: 4.0,
      reviewCount: 5,
    };
  }

  it("returns books commonly read by readers of the same book", async () => {
    const t = convexTest(schema, modules);
    const { sharer, reader1, reader2, location } = await seedBase(t);

    const { targetBookId, commonBookId } = await t.run(async (ctx) => {
      // The source book
      const targetBook = await ctx.db.insert("books", makeBook("Target Book"));
      const targetCopy = await ctx.db.insert("copies", {
        bookId: targetBook,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharer,
        qrCodeUrl: "",
        currentLocationId: location,
      });

      // A book both readers also read
      const commonBook = await ctx.db.insert("books", makeBook("Common Book"));
      const commonCopy = await ctx.db.insert("copies", {
        bookId: commonBook,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharer,
        qrCodeUrl: "",
        currentLocationId: location,
      });

      // A book only reader1 read
      const uniqueBook = await ctx.db.insert("books", makeBook("Unique Book"));
      const uniqueCopy = await ctx.db.insert("copies", {
        bookId: uniqueBook,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharer,
        qrCodeUrl: "",
        currentLocationId: location,
      });

      // Reader 1: read target + common + unique
      await ctx.db.insert("journeyEntries", {
        copyId: targetCopy, readerId: reader1, pickupLocationId: location,
        pickedUpAt: 1000, returnedAt: 2000, conditionAtPickup: "good",
        conditionAtReturn: "good", pickupPhotos: [], returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: commonCopy, readerId: reader1, pickupLocationId: location,
        pickedUpAt: 3000, returnedAt: 4000, conditionAtPickup: "good",
        conditionAtReturn: "good", pickupPhotos: [], returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: uniqueCopy, readerId: reader1, pickupLocationId: location,
        pickedUpAt: 5000, returnedAt: 6000, conditionAtPickup: "good",
        conditionAtReturn: "good", pickupPhotos: [], returnPhotos: [],
      });

      // Reader 2: read target + common (not unique)
      await ctx.db.insert("journeyEntries", {
        copyId: targetCopy, readerId: reader2, pickupLocationId: location,
        pickedUpAt: 7000, returnedAt: 8000, conditionAtPickup: "good",
        conditionAtReturn: "good", pickupPhotos: [], returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: commonCopy, readerId: reader2, pickupLocationId: location,
        pickedUpAt: 9000, returnedAt: 10000, conditionAtPickup: "good",
        conditionAtReturn: "good", pickupPhotos: [], returnPhotos: [],
      });

      return { targetBookId: targetBook, commonBookId: commonBook };
    });

    const recs = await t.query(api.recommendations.forBook, { bookId: targetBookId });

    // Both Common Book and Unique Book should appear
    expect(recs).toHaveLength(2);
    // Common Book was read by 2 readers — should rank first
    expect(recs[0].title).toBe("Common Book");
    expect(recs[0].sharedReaders).toBe(2);
    // Unique Book read by 1 reader — second
    expect(recs[1].title).toBe("Unique Book");
    expect(recs[1].sharedReaders).toBe(1);
  });

  it("excludes readers who haven't finished the book (no returnedAt)", async () => {
    const t = convexTest(schema, modules);
    const { sharer, reader1, location } = await seedBase(t);

    const { targetBookId } = await t.run(async (ctx) => {
      const targetBook = await ctx.db.insert("books", makeBook("Target"));
      const targetCopy = await ctx.db.insert("copies", {
        bookId: targetBook,
        status: "checked_out",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharer,
        qrCodeUrl: "",
        currentHolderId: reader1,
      });

      const otherBook = await ctx.db.insert("books", makeBook("Other"));
      const otherCopy = await ctx.db.insert("copies", {
        bookId: otherBook,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharer,
        qrCodeUrl: "",
        currentLocationId: location,
      });

      // Reader1 still reading target (no returnedAt)
      await ctx.db.insert("journeyEntries", {
        copyId: targetCopy, readerId: reader1, pickupLocationId: location,
        pickedUpAt: 1000, conditionAtPickup: "good",
        pickupPhotos: [], returnPhotos: [],
      });
      // Reader1 has read another book
      await ctx.db.insert("journeyEntries", {
        copyId: otherCopy, readerId: reader1, pickupLocationId: location,
        pickedUpAt: 2000, returnedAt: 3000, conditionAtPickup: "good",
        conditionAtReturn: "good", pickupPhotos: [], returnPhotos: [],
      });

      return { targetBookId: targetBook };
    });

    const recs = await t.query(api.recommendations.forBook, { bookId: targetBookId });
    // Reader1 hasn't finished target book, so no collaborative data
    expect(recs).toHaveLength(0);
  });

  it("returns empty for a book with no copies", async () => {
    const t = convexTest(schema, modules);

    const { bookId } = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: "u_empty",
        phone: "+5555555555",
        name: "Nobody",
        roles: ["reader"],
        status: "active",
        reputationScore: 50,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
      const bid = await ctx.db.insert("books", {
        title: "Lonely Book",
        author: "Solo Author",
        coverImage: "",
        description: "",
        categories: ["fiction"],
        pageCount: 100,
        language: "English",
        avgRating: 3.0,
        reviewCount: 0,
      });
      return { bookId: bid };
    });

    const recs = await t.query(api.recommendations.forBook, { bookId });
    expect(recs).toHaveLength(0);
  });

  it("does not include the source book in results", async () => {
    const t = convexTest(schema, modules);
    const { sharer, reader1, location } = await seedBase(t);

    const { targetBookId } = await t.run(async (ctx) => {
      const targetBook = await ctx.db.insert("books", makeBook("Self Ref"));
      const copy1 = await ctx.db.insert("copies", {
        bookId: targetBook,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharer,
        qrCodeUrl: "",
        currentLocationId: location,
      });
      // A second copy of the same book
      const copy2 = await ctx.db.insert("copies", {
        bookId: targetBook,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharer,
        qrCodeUrl: "",
        currentLocationId: location,
      });

      // Reader read copy1, then "read" copy2 (same book, different copy)
      await ctx.db.insert("journeyEntries", {
        copyId: copy1, readerId: reader1, pickupLocationId: location,
        pickedUpAt: 1000, returnedAt: 2000, conditionAtPickup: "good",
        conditionAtReturn: "good", pickupPhotos: [], returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: copy2, readerId: reader1, pickupLocationId: location,
        pickedUpAt: 3000, returnedAt: 4000, conditionAtPickup: "good",
        conditionAtReturn: "good", pickupPhotos: [], returnPhotos: [],
      });

      return { targetBookId: targetBook };
    });

    const recs = await t.query(api.recommendations.forBook, { bookId: targetBookId });
    // Should not recommend itself
    expect(recs).toHaveLength(0);
  });

  it("includes sharedReaders count and availableCopies in results", async () => {
    const t = convexTest(schema, modules);
    const { sharer, reader1, location } = await seedBase(t);

    await t.run(async (ctx) => {
      const targetBook = await ctx.db.insert("books", makeBook("Source"));
      const targetCopy = await ctx.db.insert("copies", {
        bookId: targetBook,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharer,
        qrCodeUrl: "",
        currentLocationId: location,
      });

      const recBook = await ctx.db.insert("books", makeBook("Recommended"));
      await ctx.db.insert("copies", {
        bookId: recBook,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharer,
        qrCodeUrl: "",
        currentLocationId: location,
      });
      const recCopy2 = await ctx.db.insert("copies", {
        bookId: recBook,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharer,
        qrCodeUrl: "",
        currentLocationId: location,
      });

      // Reader read both books
      await ctx.db.insert("journeyEntries", {
        copyId: targetCopy, readerId: reader1, pickupLocationId: location,
        pickedUpAt: 1000, returnedAt: 2000, conditionAtPickup: "good",
        conditionAtReturn: "good", pickupPhotos: [], returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: recCopy2, readerId: reader1, pickupLocationId: location,
        pickedUpAt: 3000, returnedAt: 4000, conditionAtPickup: "good",
        conditionAtReturn: "good", pickupPhotos: [], returnPhotos: [],
      });
    });

    // Need the bookId — query by title workaround: query forBook for first book
    const allBooks = await t.run(async (ctx) => {
      return await ctx.db.query("books").collect();
    });
    const sourceBook = allBooks.find((b: { title: string }) => b.title === "Source")!;

    const recs = await t.query(api.recommendations.forBook, { bookId: sourceBook._id });
    expect(recs).toHaveLength(1);
    expect(recs[0].title).toBe("Recommended");
    expect(recs[0].sharedReaders).toBe(1);
    expect(recs[0].availableCopies).toBe(2);
    expect(recs[0]).toHaveProperty("author");
    expect(recs[0]).toHaveProperty("coverImage");
    expect(recs[0]).toHaveProperty("avgRating");
  });
});
