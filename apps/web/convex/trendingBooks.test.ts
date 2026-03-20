import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_trend1",
    phone: "+1234567890",
    name: "Trending User",
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
    coverImage: "",
    description: "",
    categories: ["fiction"],
    pageCount: 200,
    language: "English",
    avgRating: 0,
    reviewCount: 0,
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

describe("trendingBooks", () => {
  it("returns empty when no journey entries exist", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("books", makeBook());
    });

    const result = await t.query(api.trendingBooks.trending, {});
    expect(result).toEqual([]);
  });

  it("returns books ranked by recent pickup count", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { popularBookId, lessPopularBookId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const user2Id = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_trend2", phone: "+2222222222", name: "User 2" }),
      );
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId as string));

      const bookA = await ctx.db.insert("books", makeBook({ title: "Popular Book", avgRating: 4.5 }));
      const bookB = await ctx.db.insert("books", makeBook({ title: "Less Popular", avgRating: 3.0 }));

      const copyA = await ctx.db.insert("copies", {
        bookId: bookA,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      const copyB = await ctx.db.insert("copies", {
        bookId: bookB,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });

      // 3 pickups for bookA (popular)
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("journeyEntries", {
          copyId: copyA,
          readerId: i % 2 === 0 ? userId : user2Id,
          pickupLocationId: locId,
          pickedUpAt: now - i * 86_400_000,
          pickupPhotos: [],
          returnPhotos: [],
          conditionAtPickup: "good" as const,
        });
      }

      // 1 pickup for bookB (less popular)
      await ctx.db.insert("journeyEntries", {
        copyId: copyB,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: now - 86_400_000,
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });

      return { popularBookId: bookA, lessPopularBookId: bookB };
    });

    const result = await t.query(api.trendingBooks.trending, {});
    expect(result).toHaveLength(2);
    expect(result[0]._id).toBe(popularBookId);
    expect(result[0].recentPickups).toBe(3);
    expect(result[0].title).toBe("Popular Book");
    expect(result[1]._id).toBe(lessPopularBookId);
    expect(result[1].recentPickups).toBe(1);
  });

  it("excludes pickups older than 30 days", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const thirtyOneDaysAgo = now - 31 * 86_400_000;

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId as string));
      const bookId = await ctx.db.insert("books", makeBook({ title: "Old Activity Book" }));
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });

      // Only old pickups — beyond 30 day window
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: thirtyOneDaysAgo,
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
    });

    const result = await t.query(api.trendingBooks.trending, {});
    expect(result).toEqual([]);
  });

  it("includes availability info", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId as string));
      const bookId = await ctx.db.insert("books", makeBook());

      // 2 copies: one available, one checked out
      const copy1 = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      await ctx.db.insert("copies", {
        bookId,
        status: "checked_out" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentHolderId: userId,
        qrCodeUrl: "",
      });

      await ctx.db.insert("journeyEntries", {
        copyId: copy1,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: now - 86_400_000,
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
    });

    const result = await t.query(api.trendingBooks.trending, {});
    expect(result).toHaveLength(1);
    expect(result[0].availableCopies).toBe(1);
    expect(result[0].totalCopies).toBe(2);
  });

  it("limits results to 10 books", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId as string));

      // Create 12 books each with a recent pickup
      for (let i = 0; i < 12; i++) {
        const bookId = await ctx.db.insert(
          "books",
          makeBook({ title: `Book ${i}` }),
        );
        const copyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "lent" as const,
          originalSharerId: userId,
          currentLocationId: locId,
          qrCodeUrl: "",
        });
        await ctx.db.insert("journeyEntries", {
          copyId,
          readerId: userId,
          pickupLocationId: locId,
          pickedUpAt: now - i * 86_400_000,
          pickupPhotos: [],
          returnPhotos: [],
          conditionAtPickup: "good" as const,
        });
      }
    });

    const result = await t.query(api.trendingBooks.trending, {});
    expect(result).toHaveLength(10);
  });

  it("works without authentication (public query)", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId as string));
      const bookId = await ctx.db.insert("books", makeBook());
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: now,
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
    });

    // No withIdentity — should work for anonymous users
    const result = await t.query(api.trendingBooks.trending, {});
    expect(result).toHaveLength(1);
    expect(result[0].recentPickups).toBe(1);
  });

  it("returns book metadata fields", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId as string));
      const bookId = await ctx.db.insert(
        "books",
        makeBook({
          title: "Detailed Book",
          author: "Jane Author",
          coverImage: "https://example.com/cover.jpg",
          categories: ["mystery", "thriller"],
          avgRating: 4.2,
          reviewCount: 15,
        }),
      );
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: now,
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
    });

    const result = await t.query(api.trendingBooks.trending, {});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Detailed Book",
      author: "Jane Author",
      coverImage: "https://example.com/cover.jpg",
      categories: ["mystery", "thriller"],
      avgRating: 4.2,
      reviewCount: 15,
      recentPickups: 1,
    });
    // Verify availableCopies is present (used by home page trending section)
    expect(result[0]).toHaveProperty("availableCopies");
    expect(typeof result[0].availableCopies).toBe("number");
  });
});
