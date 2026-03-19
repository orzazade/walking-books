import { describe, it, expect, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_streak1",
    phone: "+1234567890",
    name: "Streak User",
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
    title: "Streak Book",
    author: "Streak Author",
    coverImage: "",
    description: "",
    categories: ["fiction"],
    pageCount: 300,
    language: "English",
    avgRating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

function makeLocation(managedByUserId: Id<"users">) {
  return {
    name: "Test Location",
    address: "123 Test St",
    lat: 0,
    lng: 0,
    contactPhone: "+1111111111",
    photos: [],
    shelfCapacity: 50,
    currentBookCount: 0,
    managedByUserId,
    staffUserIds: [],
    operatingHours: {},
    avgRating: 0,
    reviewCount: 0,
  };
}

async function setupHeldCopy(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", makeUser());
    const bookId = await ctx.db.insert("books", makeBook());
    const locId = await ctx.db.insert("partnerLocations", makeLocation(userId));
    const copyId = await ctx.db.insert("copies", {
      bookId,
      status: "checked_out",
      condition: "good",
      ownershipType: "lent",
      originalSharerId: userId,
      currentHolderId: userId,
      currentLocationId: locId,
      qrCodeUrl: "",
    });
    return { userId, bookId, locId, copyId };
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("readingStreaks", () => {
  it("getStreak returns zeros when no activity exists", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_streak1" });
    const streak = await authed.query(api.readingStreaks.getStreak, {});
    expect(streak).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
    });
  });

  it("first reading progress update creates a streak of 1", async () => {
    const t = convexTest(schema, modules);
    const { copyId } = await setupHeldCopy(t);
    const authed = t.withIdentity({ subject: "user_streak1" });

    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 10,
    });

    const streak = await authed.query(api.readingStreaks.getStreak, {});
    expect(streak!.currentStreak).toBe(1);
    expect(streak!.longestStreak).toBe(1);
    expect(streak!.lastActiveDate).toBeTruthy();
  });

  it("multiple updates on the same day keep streak at 1", async () => {
    const t = convexTest(schema, modules);
    const { copyId } = await setupHeldCopy(t);
    const authed = t.withIdentity({ subject: "user_streak1" });

    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 10,
    });
    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 20,
    });
    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 30,
    });

    const streak = await authed.query(api.readingStreaks.getStreak, {});
    expect(streak!.currentStreak).toBe(1);
    expect(streak!.longestStreak).toBe(1);
  });

  it("consecutive day activity increments streak", async () => {
    const t = convexTest(schema, modules);
    const { userId, copyId } = await setupHeldCopy(t);

    // Seed a streak record for "yesterday"
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;

    await t.run(async (ctx) => {
      await ctx.db.insert("readingStreaks", {
        userId,
        currentStreak: 3,
        longestStreak: 5,
        lastActiveDate: yesterdayStr,
      });
    });

    const authed = t.withIdentity({ subject: "user_streak1" });
    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 10,
    });

    const streak = await authed.query(api.readingStreaks.getStreak, {});
    expect(streak!.currentStreak).toBe(4);
    expect(streak!.longestStreak).toBe(5);
  });

  it("gap of 2+ days resets current streak to 1", async () => {
    const t = convexTest(schema, modules);
    const { userId, copyId } = await setupHeldCopy(t);

    // Seed a streak record for 3 days ago
    const threeDaysAgo = new Date();
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
    const dateStr = `${threeDaysAgo.getUTCFullYear()}-${String(threeDaysAgo.getUTCMonth() + 1).padStart(2, "0")}-${String(threeDaysAgo.getUTCDate()).padStart(2, "0")}`;

    await t.run(async (ctx) => {
      await ctx.db.insert("readingStreaks", {
        userId,
        currentStreak: 10,
        longestStreak: 10,
        lastActiveDate: dateStr,
      });
    });

    const authed = t.withIdentity({ subject: "user_streak1" });
    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 10,
    });

    const streak = await authed.query(api.readingStreaks.getStreak, {});
    expect(streak!.currentStreak).toBe(1);
    // Longest streak should be preserved
    expect(streak!.longestStreak).toBe(10);
  });

  it("streak increments update longestStreak when it exceeds previous", async () => {
    const t = convexTest(schema, modules);
    const { userId, copyId } = await setupHeldCopy(t);

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;

    await t.run(async (ctx) => {
      await ctx.db.insert("readingStreaks", {
        userId,
        currentStreak: 5,
        longestStreak: 5,
        lastActiveDate: yesterdayStr,
      });
    });

    const authed = t.withIdentity({ subject: "user_streak1" });
    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 10,
    });

    const streak = await authed.query(api.readingStreaks.getStreak, {});
    expect(streak!.currentStreak).toBe(6);
    expect(streak!.longestStreak).toBe(6);
  });

  it("forUser returns streak for another user's public profile", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const today = new Date();
      const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
      await ctx.db.insert("readingStreaks", {
        userId: uid,
        currentStreak: 7,
        longestStreak: 14,
        lastActiveDate: todayStr,
      });
      return uid;
    });

    const streak = await t.query(api.readingStreaks.forUser, { userId });
    expect(streak).not.toBeNull();
    expect(streak!.currentStreak).toBe(7);
    expect(streak!.longestStreak).toBe(14);
  });

  it("forUser returns zeros for non-existent user", async () => {
    const t = convexTest(schema, modules);
    // Use a fake ID that doesn't exist — convexTest doesn't validate format strictly
    const userId = await t.run(async (ctx) => {
      // Create and delete to get a valid but non-existent ID
      const id = await ctx.db.insert("users", makeUser());
      await ctx.db.delete(id);
      return id;
    });

    const streak = await t.query(api.readingStreaks.forUser, { userId });
    expect(streak).toBeNull();
  });

  it("getStreak returns null for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const streak = await t.query(api.readingStreaks.getStreak, {});
    expect(streak).toBeNull();
  });

  it("forUser shows streak as 0 when last activity was 2+ days ago", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setUTCDate(fiveDaysAgo.getUTCDate() - 5);
      const dateStr = `${fiveDaysAgo.getUTCFullYear()}-${String(fiveDaysAgo.getUTCMonth() + 1).padStart(2, "0")}-${String(fiveDaysAgo.getUTCDate()).padStart(2, "0")}`;
      await ctx.db.insert("readingStreaks", {
        userId: uid,
        currentStreak: 8,
        longestStreak: 8,
        lastActiveDate: dateStr,
      });
      return uid;
    });

    const streak = await t.query(api.readingStreaks.forUser, { userId });
    expect(streak!.currentStreak).toBe(0);
    expect(streak!.longestStreak).toBe(8);
  });
});
