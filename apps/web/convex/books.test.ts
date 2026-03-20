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
