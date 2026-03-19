import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_stats1",
    phone: "+1234567890",
    name: "Stats User",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

describe("readingStats", () => {
  it("returns null for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.readingStats.getStats, {});
    expect(result).toBeNull();
  });

  it("returns zero stats for user with no reads", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_stats1" });
    const stats = await authed.query(api.readingStats.getStats, {});

    expect(stats!.totalBooksRead).toBe(0);
    expect(stats!.currentlyReading).toBe(0);
    expect(stats!.avgDaysPerBook).toBeNull();
    expect(stats!.topGenres).toEqual([]);
    expect(stats!.uniqueLocationsVisited).toBe(0);
    expect(stats!.monthlyActivity).toHaveLength(12);
  });

  it("computes correct stats from reading history", async () => {
    const t = convexTest(schema, modules);

    const { userId, locationId, locationId2 } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const loc1 = await ctx.db.insert("partnerLocations", {
        name: "Library A",
        address: "1 Main St",
        lat: 0,
        lng: 0,
        contactPhone: "+1000000000",
        operatingHours: {},
        photos: [],
        shelfCapacity: 100,
        currentBookCount: 0,
        managedByUserId: uid,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
      const loc2 = await ctx.db.insert("partnerLocations", {
        name: "Library B",
        address: "2 Oak Ave",
        lat: 1,
        lng: 1,
        contactPhone: "+1000000001",
        operatingHours: {},
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 0,
        managedByUserId: uid,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
      return { userId: uid, locationId: loc1, locationId2: loc2 };
    });

    await t.run(async (ctx) => {
      const fictionBookId = await ctx.db.insert("books", {
        title: "Fiction Book",
        author: "Author A",
        coverImage: "",
        description: "",
        categories: ["fiction", "drama"],
        pageCount: 300,
        language: "English",
        avgRating: 4,
        reviewCount: 1,
      });

      const sciFiBookId = await ctx.db.insert("books", {
        title: "Sci-Fi Book",
        author: "Author B",
        coverImage: "",
        description: "",
        categories: ["science-fiction"],
        pageCount: 250,
        language: "English",
        avgRating: 4.5,
        reviewCount: 2,
      });

      const copy1 = await ctx.db.insert("copies", {
        bookId: fictionBookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
      });

      const copy2 = await ctx.db.insert("copies", {
        bookId: sciFiBookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
      });

      // Completed read: 10 days at location 1
      await ctx.db.insert("journeyEntries", {
        copyId: copy1,
        readerId: userId,
        pickupLocationId: locationId,
        pickedUpAt: new Date(2026, 0, 1).getTime(),
        returnedAt: new Date(2026, 0, 11).getTime(),
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Completed read: 20 days at location 2
      await ctx.db.insert("journeyEntries", {
        copyId: copy2,
        readerId: userId,
        pickupLocationId: locationId2,
        pickedUpAt: new Date(2026, 1, 1).getTime(),
        returnedAt: new Date(2026, 1, 21).getTime(),
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // In progress (no returnedAt)
      await ctx.db.insert("journeyEntries", {
        copyId: copy1,
        readerId: userId,
        pickupLocationId: locationId,
        pickedUpAt: new Date(2026, 2, 1).getTime(),
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const authed = t.withIdentity({ subject: "user_stats1" });
    const stats = await authed.query(api.readingStats.getStats, {});

    expect(stats!.totalBooksRead).toBe(2);
    expect(stats!.currentlyReading).toBe(1);
    expect(stats!.avgDaysPerBook).toBe(15); // (10 + 20) / 2
    expect(stats!.uniqueLocationsVisited).toBe(2);

    // Genre breakdown: fiction=1, drama=1, science-fiction=1
    expect(stats!.topGenres).toHaveLength(3);
    const genreNames = stats!.topGenres.map((g) => g.genre);
    expect(genreNames).toContain("fiction");
    expect(genreNames).toContain("science-fiction");
  });

  it("allows viewing another user's stats by userId", async () => {
    const t = convexTest(schema, modules);

    const targetUserId = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_stats2", name: "Viewer", phone: "+9999999999" }),
      );
      return uid;
    });

    const viewer = t.withIdentity({ subject: "user_stats2" });
    const stats = await viewer.query(api.readingStats.getStats, {
      userId: targetUserId,
    });

    expect(stats).not.toBeNull();
    expect(stats!.totalBooksRead).toBe(0);
  });
});
