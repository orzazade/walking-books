import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_lb1",
    phone: "+1234567890",
    name: "Leaderboard User",
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

describe("leaderboard", () => {
  describe("topReaders", () => {
    it("returns empty when no completed reads exist", async () => {
      const t = convexTest(schema, modules);
      const result = await t.query(api.leaderboard.topReaders, {});
      expect(result).toEqual([]);
    });

    it("ranks readers by completed reads in last 30 days", async () => {
      const t = convexTest(schema, modules);
      const now = Date.now();

      const { topReaderId, secondReaderId } = await t.run(async (ctx) => {
        const user1 = await ctx.db.insert("users", makeUser({ clerkId: "reader1", name: "Top Reader" }));
        const user2 = await ctx.db.insert("users", makeUser({ clerkId: "reader2", phone: "+2222222222", name: "Second Reader" }));
        const locId = await ctx.db.insert("partnerLocations", makeLocation(user1 as string));
        const bookId = await ctx.db.insert("books", makeBook());

        // user1 completes 3 reads, user2 completes 1
        for (let i = 0; i < 3; i++) {
          const copyId = await ctx.db.insert("copies", {
            bookId,
            status: "available" as const,
            condition: "good" as const,
            ownershipType: "lent" as const,
            originalSharerId: user2,
            currentLocationId: locId,
            qrCodeUrl: "",
          });
          await ctx.db.insert("journeyEntries", {
            copyId,
            readerId: user1,
            pickupLocationId: locId,
            pickedUpAt: now - 5 * 86_400_000,
            returnedAt: now - 86_400_000,
            pickupPhotos: [],
            returnPhotos: [],
            conditionAtPickup: "good" as const,
            conditionAtReturn: "good" as const,
          });
        }

        const copyForUser2 = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "lent" as const,
          originalSharerId: user1,
          currentLocationId: locId,
          qrCodeUrl: "",
        });
        await ctx.db.insert("journeyEntries", {
          copyId: copyForUser2,
          readerId: user2,
          pickupLocationId: locId,
          pickedUpAt: now - 3 * 86_400_000,
          returnedAt: now - 86_400_000,
          pickupPhotos: [],
          returnPhotos: [],
          conditionAtPickup: "good" as const,
          conditionAtReturn: "good" as const,
        });

        return { topReaderId: user1, secondReaderId: user2 };
      });

      const result = await t.query(api.leaderboard.topReaders, {});
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(topReaderId);
      expect(result[0].completedReads).toBe(3);
      expect(result[0].name).toBe("Top Reader");
      expect(result[1].userId).toBe(secondReaderId);
      expect(result[1].completedReads).toBe(1);
    });

    it("excludes incomplete reads (no returnedAt)", async () => {
      const t = convexTest(schema, modules);
      const now = Date.now();

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", makeUser());
        const locId = await ctx.db.insert("partnerLocations", makeLocation(userId as string));
        const bookId = await ctx.db.insert("books", makeBook());
        const copyId = await ctx.db.insert("copies", {
          bookId,
          status: "checked_out" as const,
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

      const result = await t.query(api.leaderboard.topReaders, {});
      expect(result).toEqual([]);
    });

    it("excludes reads older than 30 days", async () => {
      const t = convexTest(schema, modules);
      const thirtyOneDaysAgo = Date.now() - 31 * 86_400_000;

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
          pickedUpAt: thirtyOneDaysAgo,
          returnedAt: thirtyOneDaysAgo + 3_600_000,
          pickupPhotos: [],
          returnPhotos: [],
          conditionAtPickup: "good" as const,
          conditionAtReturn: "good" as const,
        });
      });

      const result = await t.query(api.leaderboard.topReaders, {});
      expect(result).toEqual([]);
    });
  });

  describe("topSharers", () => {
    it("returns empty when no lends exist", async () => {
      const t = convexTest(schema, modules);
      const result = await t.query(api.leaderboard.topSharers, {});
      expect(result).toEqual([]);
    });

    it("ranks sharers by books lent in last 30 days", async () => {
      const t = convexTest(schema, modules);
      const now = Date.now();

      const { topSharerId } = await t.run(async (ctx) => {
        const sharer = await ctx.db.insert("users", makeUser({ clerkId: "sharer1", name: "Top Sharer", booksShared: 5 }));
        const reader = await ctx.db.insert("users", makeUser({ clerkId: "reader1", phone: "+2222222222", name: "Reader" }));
        const locId = await ctx.db.insert("partnerLocations", makeLocation(sharer as string));

        // Sharer has 2 copies lent out recently
        for (let i = 0; i < 2; i++) {
          const bookId = await ctx.db.insert("books", makeBook({ title: `Book ${i}` }));
          const copyId = await ctx.db.insert("copies", {
            bookId,
            status: "available" as const,
            condition: "good" as const,
            ownershipType: "lent" as const,
            originalSharerId: sharer,
            currentLocationId: locId,
            qrCodeUrl: "",
          });
          await ctx.db.insert("journeyEntries", {
            copyId,
            readerId: reader,
            pickupLocationId: locId,
            pickedUpAt: now - 86_400_000,
            pickupPhotos: [],
            returnPhotos: [],
            conditionAtPickup: "good" as const,
          });
        }

        return { topSharerId: sharer };
      });

      const result = await t.query(api.leaderboard.topSharers, {});
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(topSharerId);
      expect(result[0].booksLent).toBe(2);
      expect(result[0].name).toBe("Top Sharer");
    });
  });

  describe("topStreaks", () => {
    it("returns empty when no streaks exist", async () => {
      const t = convexTest(schema, modules);
      const result = await t.query(api.leaderboard.topStreaks, {});
      expect(result).toEqual([]);
    });

    it("ranks users by current streak length", async () => {
      const t = convexTest(schema, modules);
      const today = new Date();
      const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

      const { longStreakId, shortStreakId } = await t.run(async (ctx) => {
        const user1 = await ctx.db.insert("users", makeUser({ clerkId: "streak1", name: "Long Streak" }));
        const user2 = await ctx.db.insert("users", makeUser({ clerkId: "streak2", phone: "+2222222222", name: "Short Streak" }));

        await ctx.db.insert("readingStreaks", {
          userId: user1,
          currentStreak: 15,
          longestStreak: 20,
          lastActiveDate: todayStr,
        });
        await ctx.db.insert("readingStreaks", {
          userId: user2,
          currentStreak: 5,
          longestStreak: 5,
          lastActiveDate: todayStr,
        });

        return { longStreakId: user1, shortStreakId: user2 };
      });

      const result = await t.query(api.leaderboard.topStreaks, {});
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(longStreakId);
      expect(result[0].currentStreak).toBe(15);
      expect(result[0].longestStreak).toBe(20);
      expect(result[0].name).toBe("Long Streak");
      expect(result[1].userId).toBe(shortStreakId);
      expect(result[1].currentStreak).toBe(5);
    });

    it("excludes stale streaks (inactive for 2+ days)", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", makeUser());
        await ctx.db.insert("readingStreaks", {
          userId,
          currentStreak: 10,
          longestStreak: 10,
          lastActiveDate: "2020-01-01",
        });
      });

      const result = await t.query(api.leaderboard.topStreaks, {});
      expect(result).toEqual([]);
    });

    it("is a public query (no auth required)", async () => {
      const t = convexTest(schema, modules);
      // No withIdentity — should work for anonymous users
      const result = await t.query(api.leaderboard.topStreaks, {});
      expect(result).toEqual([]);
    });
  });
});
