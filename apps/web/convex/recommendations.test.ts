import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

describe("recommendations", () => {
  it("recommends books matching user favorite genres, excludes already-read", async () => {
    const t = convexTest(schema);

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

    const recs = await t.query(api.recommendations.forMe, {}, {
      asIdentity: { subject: "user_rec1" },
    });

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
    const t = convexTest(schema);

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

    const recs = await t.query(api.recommendations.forMe, {}, {
      asIdentity: { subject: "user_rec2" },
    });

    expect(recs).toHaveLength(2);
    // With no genre prefs, available + high-rated wins
    expect(recs[0].title).toBe("Top Rated");
    expect(recs[1].title).toBe("Low Rated");
  });

  it("returns empty array for unauthenticated users", async () => {
    const t = convexTest(schema);
    const recs = await t.query(api.recommendations.forMe, {});
    expect(recs).toEqual([]);
  });
});
