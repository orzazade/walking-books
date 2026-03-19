import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_ach1",
    phone: "+1234567890",
    name: "Achievement User",
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

function makeLocation(managedByUserId: any, overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Location",
    address: "123 Test St",
    lat: 0,
    lng: 0,
    contactPhone: "+1000000000",
    operatingHours: "9-5",
    photos: [],
    shelfCapacity: 50,
    currentBookCount: 0,
    managedByUserId,
    staffUserIds: [],
    avgRating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

describe("achievements", () => {
  it("returns empty array for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.achievements.myAchievements, {});
    expect(result).toEqual([]);
  });

  it("returns all achievements locked for a new user", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_ach1" });
    const achievements = await authed.query(api.achievements.myAchievements, {});
    expect(achievements.length).toBeGreaterThan(0);
    expect(achievements.every((a: { unlocked: boolean }) => !a.unlocked)).toBe(true);
  });

  it("unlocks first_read after completing a book", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId));
      const bookId = await ctx.db.insert("books", makeBook());
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
        lendingPeriodDays: 14,
        sharerMaxLendingDays: 30,
      });
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: Date.now() - 86400000,
        returnedAt: Date.now(),
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const authed = t.withIdentity({ subject: "user_ach1" });
    const achievements = await authed.query(api.achievements.myAchievements, {});
    const firstRead = achievements.find((a: { key: string }) => a.key === "first_read");
    expect(firstRead?.unlocked).toBe(true);
  });

  it("unlocks books_shared_1 when user shares a copy", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId));
      const bookId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
        lendingPeriodDays: 14,
        sharerMaxLendingDays: 30,
      });
    });

    const authed = t.withIdentity({ subject: "user_ach1" });
    const achievements = await authed.query(api.achievements.myAchievements, {});
    const shared = achievements.find((a: { key: string }) => a.key === "books_shared_1");
    expect(shared?.unlocked).toBe(true);
  });

  it("unlocks first_review after writing a review", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("reviews", {
        bookId,
        userId,
        rating: 4,
        text: "Great book!",
      });
    });

    const authed = t.withIdentity({ subject: "user_ach1" });
    const achievements = await authed.query(api.achievements.myAchievements, {});
    const critic = achievements.find((a: { key: string }) => a.key === "first_review");
    expect(critic?.unlocked).toBe(true);
  });

  it("unlocks first_follow after following another user", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const otherId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_ach2", phone: "+9999999999", name: "Other" }),
      );
      await ctx.db.insert("follows", {
        followerId: userId,
        followingId: otherId,
      });
    });

    const authed = t.withIdentity({ subject: "user_ach1" });
    const achievements = await authed.query(api.achievements.myAchievements, {});
    const social = achievements.find((a: { key: string }) => a.key === "first_follow");
    expect(social?.unlocked).toBe(true);
  });

  it("unlocks collection_created after creating a collection", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      await ctx.db.insert("collections", {
        userId,
        name: "My Favorites",
        description: "",
        isPublic: true,
        createdAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: "user_ach1" });
    const achievements = await authed.query(api.achievements.myAchievements, {});
    const curator = achievements.find((a: { key: string }) => a.key === "collection_created");
    expect(curator?.unlocked).toBe(true);
  });

  it("unlocks genres_3 after reading 3 different genres", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId));

      const genres = ["fiction", "science", "history"];
      for (const genre of genres) {
        const bookId = await ctx.db.insert(
          "books",
          makeBook({ title: `Book ${genre}`, categories: [genre] }),
        );
        const copyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "lent" as const,
          originalSharerId: userId,
          currentLocationId: locId,
          qrCodeUrl: "",
          lendingPeriodDays: 14,
          sharerMaxLendingDays: 30,
        });
        await ctx.db.insert("journeyEntries", {
          copyId,
          readerId: userId,
          pickupLocationId: locId,
          pickedUpAt: Date.now() - 86400000,
          returnedAt: Date.now(),
          conditionAtPickup: "good",
          pickupPhotos: [],
          returnPhotos: [],
        });
      }
    });

    const authed = t.withIdentity({ subject: "user_ach1" });
    const achievements = await authed.query(api.achievements.myAchievements, {});
    const explorer = achievements.find((a: { key: string }) => a.key === "genres_3");
    expect(explorer?.unlocked).toBe(true);
  });

  it("unlocks locations_3 after visiting 3 locations", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());

      for (let i = 0; i < 3; i++) {
        const locId = await ctx.db.insert(
          "partnerLocations",
          makeLocation(userId, { name: `Location ${i}`, address: `${i} Main St` }),
        );
        const copyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "lent" as const,
          originalSharerId: userId,
          currentLocationId: locId,
          qrCodeUrl: "",
          lendingPeriodDays: 14,
          sharerMaxLendingDays: 30,
        });
        await ctx.db.insert("journeyEntries", {
          copyId,
          readerId: userId,
          pickupLocationId: locId,
          pickedUpAt: Date.now() - 86400000,
          returnedAt: Date.now(),
          conditionAtPickup: "good",
          pickupPhotos: [],
          returnPhotos: [],
        });
      }
    });

    const authed = t.withIdentity({ subject: "user_ach1" });
    const achievements = await authed.query(api.achievements.myAchievements, {});
    const wanderer = achievements.find((a: { key: string }) => a.key === "locations_3");
    expect(wanderer?.unlocked).toBe(true);
  });

  it("unlocks goal_completed when annual goal is met", async () => {
    const t = convexTest(schema, modules);
    const year = new Date().getFullYear();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId));
      await ctx.db.insert("readingGoals", {
        userId,
        year,
        targetBooks: 1,
      });

      const bookId = await ctx.db.insert("books", makeBook());
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
        lendingPeriodDays: 14,
        sharerMaxLendingDays: 30,
      });
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: Date.now() - 86400000,
        returnedAt: Date.now(),
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const authed = t.withIdentity({ subject: "user_ach1" });
    const achievements = await authed.query(api.achievements.myAchievements, {});
    const goalGetter = achievements.find((a: { key: string }) => a.key === "goal_completed");
    expect(goalGetter?.unlocked).toBe(true);
  });

  it("forUser returns only unlocked achievements for public view", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("reviews", {
        bookId,
        userId: uid,
        rating: 5,
        text: "Loved it",
      });
      return uid;
    });

    const achievements = await t.query(api.achievements.forUser, { userId });
    expect(achievements.length).toBeGreaterThan(0);
    expect(achievements.every((a: { unlocked: boolean }) => a.unlocked)).toBe(true);
    const keys = achievements.map((a: { key: string }) => a.key);
    expect(keys).toContain("first_review");
    expect(keys).not.toContain("first_read");
  });

  it("forUser returns empty for nonexistent user", async () => {
    const t = convexTest(schema, modules);
    const fakeId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", makeUser());
      await ctx.db.delete(id);
      return id;
    });
    const achievements = await t.query(api.achievements.forUser, { userId: fakeId });
    expect(achievements).toEqual([]);
  });
});
