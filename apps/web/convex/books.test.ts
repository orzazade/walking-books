import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_books1",
    phone: "+1234567890",
    name: "Test User",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

function makeBook(overrides: Record<string, unknown> = {}) {
  return {
    title: "Test Book",
    author: "Test Author",
    coverImage: "https://example.com/cover.jpg",
    description: "A test book",
    categories: ["fiction"],
    pageCount: 200,
    language: "English",
    avgRating: 4.0,
    reviewCount: 2,
    ...overrides,
  };
}

function makeLocation(managedByUserId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Location",
    address: "123 Test St",
    lat: 0,
    lng: 0,
    contactPhone: "+1234567890",
    operatingHours: {},
    photos: [],
    shelfCapacity: 100,
    currentBookCount: 0,
    managedByUserId,
    staffUserIds: [],
    avgRating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

function makeCopy(
  bookId: string,
  locationId: string,
  sharerId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    bookId,
    currentLocationId: locationId,
    originalSharerId: sharerId,
    status: "available" as const,
    condition: "good" as const,
    ownershipType: "lent" as const,
    lendingPeriodDays: 21,
    qrCodeUrl: "",
    ...overrides,
  };
}

describe("books.register", () => {
  it("registers a new book and creates a copy at the location", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as unknown as string),
      );
      return { locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_books1" });
    const result = await authed.mutation(api.books.register, {
      title: "New Shared Book",
      author: "Great Author",
      coverImage: "https://example.com/cover.jpg",
      description: "A wonderful book",
      categories: ["fiction", "adventure"],
      pageCount: 300,
      language: "English",
      ownershipType: "donated",
      condition: "like_new",
      locationId,
    });

    expect(result.bookId).toBeDefined();
    expect(result.copyId).toBeDefined();
  });

  it("rejects empty title", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as unknown as string),
      );
      return { locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_books1" });
    await expect(
      authed.mutation(api.books.register, {
        title: "   ",
        author: "Author",
        coverImage: "https://example.com/cover.jpg",
        description: "desc",
        categories: [],
        pageCount: 200,
        language: "English",
        ownershipType: "donated",
        condition: "good",
        locationId,
      }),
    ).rejects.toThrow("Title is required");
  });

  it("rejects more than 10 categories", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as unknown as string),
      );
      return { locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_books1" });
    await expect(
      authed.mutation(api.books.register, {
        title: "Book",
        author: "Author",
        coverImage: "https://example.com/cover.jpg",
        description: "desc",
        categories: Array.from({ length: 11 }, (_, i) => `cat${i}`),
        pageCount: 200,
        language: "English",
        ownershipType: "donated",
        condition: "good",
        locationId,
      }),
    ).rejects.toThrow("Maximum 10 categories");
  });
});

describe("books.atLocationCatalog", () => {
  it("returns empty when no copies at location", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locationId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });

    const result = await t.query(api.books.atLocationCatalog, { locationId });
    expect(result).toEqual([]);
  });

  it("returns books available at location with copy counts", async () => {
    const t = convexTest(schema, modules);
    const { userId, locationId, bookId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const lid = await ctx.db.insert("partnerLocations", makeLocation(uid));
      const bid = await ctx.db.insert("books", makeBook());
      // Two available copies of same book at this location
      await ctx.db.insert("copies", makeCopy(bid, lid, uid));
      await ctx.db.insert("copies", makeCopy(bid, lid, uid));
      return { userId: uid, locationId: lid, bookId: bid };
    });

    const result = await t.query(api.books.atLocationCatalog, { locationId });
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe(bookId);
    expect(result[0].availableCopies).toBe(2);
    expect(result[0].title).toBe("Test Book");
  });

  it("excludes non-available copies", async () => {
    const t = convexTest(schema, modules);
    const { locationId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const lid = await ctx.db.insert("partnerLocations", makeLocation(uid));
      const bid = await ctx.db.insert("books", makeBook());
      // One available, one checked out
      await ctx.db.insert("copies", makeCopy(bid, lid, uid));
      await ctx.db.insert(
        "copies",
        makeCopy(bid, lid, uid, { status: "checked_out" }),
      );
      return { locationId: lid };
    });

    const result = await t.query(api.books.atLocationCatalog, { locationId });
    expect(result).toHaveLength(1);
    expect(result[0].availableCopies).toBe(1);
  });

  it("excludes copies at other locations", async () => {
    const t = convexTest(schema, modules);
    const { locationId1 } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const lid1 = await ctx.db.insert(
        "partnerLocations",
        makeLocation(uid, { name: "Location A" }),
      );
      const lid2 = await ctx.db.insert(
        "partnerLocations",
        makeLocation(uid, { name: "Location B" }),
      );
      const bid = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("copies", makeCopy(bid, lid1, uid));
      await ctx.db.insert("copies", makeCopy(bid, lid2, uid));
      return { locationId1: lid1 };
    });

    const result = await t.query(api.books.atLocationCatalog, {
      locationId: locationId1,
    });
    expect(result).toHaveLength(1);
    expect(result[0].availableCopies).toBe(1);
  });

  it("returns multiple books sorted by availability then rating", async () => {
    const t = convexTest(schema, modules);
    const { locationId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const lid = await ctx.db.insert("partnerLocations", makeLocation(uid));
      const bookA = await ctx.db.insert(
        "books",
        makeBook({ title: "Book A", avgRating: 3.0 }),
      );
      const bookB = await ctx.db.insert(
        "books",
        makeBook({ title: "Book B", avgRating: 5.0 }),
      );
      // Book A: 1 copy, Book B: 2 copies
      await ctx.db.insert("copies", makeCopy(bookA, lid, uid));
      await ctx.db.insert("copies", makeCopy(bookB, lid, uid));
      await ctx.db.insert("copies", makeCopy(bookB, lid, uid));
      return { locationId: lid };
    });

    const result = await t.query(api.books.atLocationCatalog, { locationId });
    expect(result).toHaveLength(2);
    // Book B first (2 copies vs 1)
    expect(result[0].title).toBe("Book B");
    expect(result[0].availableCopies).toBe(2);
    expect(result[1].title).toBe("Book A");
    expect(result[1].availableCopies).toBe(1);
  });
});

describe("books.byAuthor", () => {
  it("returns empty for a book with no other books by same author", async () => {
    const t = convexTest(schema, modules);
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook({ author: "Unique Author" }));
    });

    const result = await t.query(api.books.byAuthor, { bookId });
    expect(result).toEqual([]);
  });

  it("returns other books by the same author excluding the current book", async () => {
    const t = convexTest(schema, modules);
    const { bookId, otherBookId } = await t.run(async (ctx) => {
      const bid1 = await ctx.db.insert(
        "books",
        makeBook({ title: "Book One", author: "Jane Doe" }),
      );
      const bid2 = await ctx.db.insert(
        "books",
        makeBook({ title: "Book Two", author: "Jane Doe" }),
      );
      // Different author — should not appear
      await ctx.db.insert(
        "books",
        makeBook({ title: "Book Three", author: "Someone Else" }),
      );
      return { bookId: bid1, otherBookId: bid2 };
    });

    const result = await t.query(api.books.byAuthor, { bookId });
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe(otherBookId);
    expect(result[0].title).toBe("Book Two");
  });

  it("matches author name case-insensitively", async () => {
    const t = convexTest(schema, modules);
    const bookId = await t.run(async (ctx) => {
      const bid = await ctx.db.insert(
        "books",
        makeBook({ title: "Book A", author: "jane doe" }),
      );
      await ctx.db.insert(
        "books",
        makeBook({ title: "Book B", author: "Jane Doe" }),
      );
      return bid;
    });

    const result = await t.query(api.books.byAuthor, { bookId });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Book B");
  });
});

describe("books.allAuthors", () => {
  it("returns empty when no books exist", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.books.allAuthors, {});
    expect(result).toEqual([]);
  });

  it("groups books by author with counts and availability", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const lid = await ctx.db.insert("partnerLocations", makeLocation(uid));

      const book1 = await ctx.db.insert(
        "books",
        makeBook({ title: "Book A", author: "Jane Doe", categories: ["fiction"] }),
      );
      const book2 = await ctx.db.insert(
        "books",
        makeBook({ title: "Book B", author: "Jane Doe", categories: ["mystery"] }),
      );
      const book3 = await ctx.db.insert(
        "books",
        makeBook({ title: "Book C", author: "John Smith", categories: ["science"] }),
      );

      // Jane has 2 available copies across her books, John has 1
      await ctx.db.insert("copies", makeCopy(book1, lid, uid));
      await ctx.db.insert("copies", makeCopy(book2, lid, uid));
      await ctx.db.insert("copies", makeCopy(book3, lid, uid));
    });

    const result = await t.query(api.books.allAuthors, {});
    expect(result).toHaveLength(2);
    // Alphabetical: Jane Doe first
    expect(result[0].author).toBe("Jane Doe");
    expect(result[0].bookCount).toBe(2);
    expect(result[0].availableCount).toBe(2);
    expect(result[1].author).toBe("John Smith");
    expect(result[1].bookCount).toBe(1);
  });

  it("normalizes author names case-insensitively", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "books",
        makeBook({ title: "Book A", author: "jane doe" }),
      );
      await ctx.db.insert(
        "books",
        makeBook({ title: "Book B", author: "Jane Doe" }),
      );
    });

    const result = await t.query(api.books.allAuthors, {});
    // Should be grouped as one author
    expect(result).toHaveLength(1);
    expect(result[0].bookCount).toBe(2);
  });
});

describe("books.byAuthorName", () => {
  it("returns empty for unknown author", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.books.byAuthorName, { author: "Nobody" });
    expect(result).toEqual([]);
  });

  it("returns books by author enriched with availability", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const lid = await ctx.db.insert("partnerLocations", makeLocation(uid));
      const book = await ctx.db.insert(
        "books",
        makeBook({ title: "Found Book", author: "Target Author" }),
      );
      await ctx.db.insert(
        "books",
        makeBook({ title: "Other Book", author: "Someone Else" }),
      );
      await ctx.db.insert("copies", makeCopy(book, lid, uid));
    });

    const result = await t.query(api.books.byAuthorName, { author: "Target Author" });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Found Book");
    expect(result[0].availableCopies).toBe(1);
  });

  it("matches case-insensitively", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "books",
        makeBook({ title: "Book X", author: "Jane Doe" }),
      );
    });

    const result = await t.query(api.books.byAuthorName, { author: "jane doe" });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Book X");
  });

  it("returns empty for blank author string", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("books", makeBook());
    });

    const result = await t.query(api.books.byAuthorName, { author: "  " });
    expect(result).toEqual([]);
  });
});

describe("books.allCategories", () => {
  it("returns empty when no books exist", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.books.allCategories, {});
    expect(result).toEqual([]);
  });

  it("groups books by category with counts and availability", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const lid = await ctx.db.insert("partnerLocations", makeLocation(uid));

      const book1 = await ctx.db.insert(
        "books",
        makeBook({ title: "Book A", author: "Jane Doe", categories: ["Fiction", "Mystery"] }),
      );
      const book2 = await ctx.db.insert(
        "books",
        makeBook({ title: "Book B", author: "John Smith", categories: ["Fiction"] }),
      );
      const book3 = await ctx.db.insert(
        "books",
        makeBook({ title: "Book C", author: "Alice", categories: ["Science"] }),
      );

      await ctx.db.insert("copies", makeCopy(book1, lid, uid));
      await ctx.db.insert("copies", makeCopy(book2, lid, uid));
      await ctx.db.insert("copies", makeCopy(book3, lid, uid));
    });

    const result = await t.query(api.books.allCategories, {});
    expect(result).toHaveLength(3);
    // Alphabetical: Fiction, Mystery, Science
    expect(result[0].category).toBe("Fiction");
    expect(result[0].bookCount).toBe(2);
    expect(result[0].availableCount).toBe(2);
    expect(result[0].topAuthors).toContain("Jane Doe");
    expect(result[0].topAuthors).toContain("John Smith");
    expect(result[1].category).toBe("Mystery");
    expect(result[1].bookCount).toBe(1);
    expect(result[2].category).toBe("Science");
    expect(result[2].bookCount).toBe(1);
  });
});

describe("books.socialProof", () => {
  it("returns zeros for a book with no activity", async () => {
    const t = convexTest(schema, modules);
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });

    const result = await t.query(api.books.socialProof, { bookId });
    expect(result).toEqual({
      currentlyReading: 0,
      wishlisted: 0,
      completedReads: 0,
    });
  });

  it("counts active readers, wishlists, and completed reads", async () => {
    const t = convexTest(schema, modules);
    const { bookId } = await t.run(async (ctx) => {
      const uid1 = await ctx.db.insert("users", makeUser({ clerkId: "u1" }));
      const uid2 = await ctx.db.insert("users", makeUser({ clerkId: "u2", phone: "+9999999999" }));
      const bid = await ctx.db.insert("books", makeBook());
      const lid = await ctx.db.insert("partnerLocations", makeLocation(uid1));
      const copyId = await ctx.db.insert("copies", makeCopy(bid, lid, uid1));

      // One active reader
      await ctx.db.insert("readingProgress", {
        userId: uid1,
        copyId,
        bookId: bid,
        currentPage: 50,
        totalPages: 200,
        status: "reading",
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
      });
      // One finished reader (should NOT count as currently reading)
      await ctx.db.insert("readingProgress", {
        userId: uid2,
        copyId,
        bookId: bid,
        currentPage: 200,
        totalPages: 200,
        status: "finished",
        startedAt: Date.now() - 100000,
        lastUpdatedAt: Date.now(),
        finishedAt: Date.now(),
      });
      // Two wishlist entries
      await ctx.db.insert("wishlist", { userId: uid1, bookId: bid, addedAt: Date.now() });
      await ctx.db.insert("wishlist", { userId: uid2, bookId: bid, addedAt: Date.now() });
      // One completed journey (returned)
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: uid1,
        pickupLocationId: lid,
        pickedUpAt: Date.now() - 200000,
        returnedAt: Date.now() - 100000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      return { bookId: bid };
    });

    const result = await t.query(api.books.socialProof, { bookId });
    expect(result.currentlyReading).toBe(1);
    expect(result.wishlisted).toBe(2);
    expect(result.completedReads).toBe(1);
  });
});

describe("books.nearMe", () => {
  it("returns books at nearby locations sorted by distance", async () => {
    const t = convexTest(schema, modules);
    const { bookNearId, bookFarId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      // Close location (~1.1 km from origin)
      const closeLoc = await ctx.db.insert(
        "partnerLocations",
        makeLocation(uid, { name: "Close Cafe", lat: 0.01, lng: 0 }),
      );
      // Farther location (~11 km from origin, still within default 25km radius)
      const farLoc = await ctx.db.insert(
        "partnerLocations",
        makeLocation(uid, { name: "Far Library", lat: 0.1, lng: 0 }),
      );
      const bookNear = await ctx.db.insert("books", makeBook({ title: "Near Book" }));
      const bookFar = await ctx.db.insert("books", makeBook({ title: "Far Book" }));
      await ctx.db.insert("copies", makeCopy(bookNear, closeLoc, uid));
      await ctx.db.insert("copies", makeCopy(bookFar, farLoc, uid));
      return { bookNearId: bookNear, bookFarId: bookFar };
    });

    const result = await t.query(api.books.nearMe, { lat: 0, lng: 0 });
    expect(result).toHaveLength(2);
    expect(result[0]._id).toBe(bookNearId);
    expect(result[0].nearestLocationName).toBe("Close Cafe");
    expect(result[0].nearestDistanceKm).toBeLessThan(2);
    expect(result[1]._id).toBe(bookFarId);
    expect(result[1].nearestDistanceKm).toBeGreaterThan(10);
  });

  it("excludes locations beyond radius", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      // Location ~111 km away (beyond default 25km radius)
      const farLoc = await ctx.db.insert(
        "partnerLocations",
        makeLocation(uid, { name: "Far", lat: 1, lng: 0 }),
      );
      const bid = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("copies", makeCopy(bid, farLoc, uid));
    });

    const result = await t.query(api.books.nearMe, { lat: 0, lng: 0, radiusKm: 5 });
    expect(result).toEqual([]);
  });
});
