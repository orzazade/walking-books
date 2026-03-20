import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_goal1",
    phone: "+1234567890",
    name: "Goal User",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

describe("readingGoals", () => {
  it("setGoal creates a new reading goal", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    const result = await authed.mutation(api.readingGoals.setGoal, {
      year: 2026,
      targetBooks: 24,
    });
    expect(result._id).toBeDefined();

    const progress = await authed.query(api.readingGoals.getProgress, {
      year: 2026,
    });
    expect(progress!.targetBooks).toBe(24);
    expect(progress!.completedReads).toBe(0);
    expect(progress!.progressPercent).toBe(0);
  });

  it("setGoal updates an existing goal for the same year", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    await authed.mutation(api.readingGoals.setGoal, {
      year: 2026,
      targetBooks: 12,
    });
    await authed.mutation(api.readingGoals.setGoal, {
      year: 2026,
      targetBooks: 30,
    });

    const progress = await authed.query(api.readingGoals.getProgress, {
      year: 2026,
    });
    expect(progress!.targetBooks).toBe(30);
  });

  it("removeGoal deletes the goal", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    await authed.mutation(api.readingGoals.setGoal, {
      year: 2026,
      targetBooks: 10,
    });
    await authed.mutation(api.readingGoals.removeGoal, { year: 2026 });

    const progress = await authed.query(api.readingGoals.getProgress, {
      year: 2026,
    });
    expect(progress!.targetBooks).toBeNull();
    expect(progress!.progressPercent).toBeNull();
  });

  it("getProgress counts completed reads in the correct year", async () => {
    const t = convexTest(schema, modules);

    const { userId, locationId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", {
        name: "Test Library",
        address: "123 Main St",
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
      return { userId: uid, locationId: locId };
    });

    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", {
        title: "Test Book",
        author: "Author",
        coverImage: "",
        description: "",
        categories: ["fiction"],
        pageCount: 200,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });
    });

    // Create 2 completed reads in 2026, 1 in 2025, 1 still in progress
    await t.run(async (ctx) => {
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
      });

      // Completed in 2026 (Jan)
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locationId,
        pickedUpAt: new Date(2026, 0, 5).getTime(),
        returnedAt: new Date(2026, 0, 20).getTime(),
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Completed in 2026 (March)
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locationId,
        pickedUpAt: new Date(2026, 2, 1).getTime(),
        returnedAt: new Date(2026, 2, 15).getTime(),
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Completed in 2025 (should NOT count for 2026)
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locationId,
        pickedUpAt: new Date(2025, 5, 1).getTime(),
        returnedAt: new Date(2025, 5, 20).getTime(),
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Still in progress (no returnedAt — should NOT count)
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locationId,
        pickedUpAt: new Date(2026, 3, 1).getTime(),
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    await authed.mutation(api.readingGoals.setGoal, {
      year: 2026,
      targetBooks: 10,
    });

    const progress = await authed.query(api.readingGoals.getProgress, {
      year: 2026,
    });
    expect(progress!.completedReads).toBe(2);
    expect(progress!.targetBooks).toBe(10);
    expect(progress!.progressPercent).toBe(20);
  });

  it("getProgress returns null for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.readingGoals.getProgress, {
      year: 2026,
    });
    expect(result).toBeNull();
  });

  it("setGoal throws for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.readingGoals.setGoal, {
        year: 2026,
        targetBooks: 10,
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("setGoal rejects invalid target", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    await expect(
      authed.mutation(api.readingGoals.setGoal, {
        year: 2026,
        targetBooks: 0,
      }),
    ).rejects.toThrow("Target must be between 1 and 1000");
  });

  it("getProgress returns completedReads without a goal set (dashboard no-goal state)", async () => {
    const t = convexTest(schema, modules);

    const { userId, locationId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", {
        name: "Library",
        address: "789 Pine St",
        lat: 0,
        lng: 0,
        contactPhone: "+1000000002",
        operatingHours: {},
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 0,
        managedByUserId: uid,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
      return { userId: uid, locationId: locId };
    });

    await t.run(async (ctx) => {
      const bookId = await ctx.db.insert("books", {
        title: "No Goal Book",
        author: "Author",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 100,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });

      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
      });

      // 2 completed reads in 2026, no goal set
      for (let i = 0; i < 2; i++) {
        await ctx.db.insert("journeyEntries", {
          copyId,
          readerId: userId,
          pickupLocationId: locationId,
          pickedUpAt: new Date(2026, i, 1).getTime(),
          returnedAt: new Date(2026, i, 15).getTime(),
          conditionAtPickup: "good",
          conditionAtReturn: "good",
          pickupPhotos: [],
          returnPhotos: [],
        });
      }
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    // No setGoal call — user hasn't set a goal
    const progress = await authed.query(api.readingGoals.getProgress, {
      year: 2026,
    });
    expect(progress!.completedReads).toBe(2);
    expect(progress!.targetBooks).toBeNull();
    expect(progress!.progressPercent).toBeNull();
  });

  it("setMonthlyGoal creates and tracks per-month progress", async () => {
    const t = convexTest(schema, modules);

    const { userId, locationId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", {
        name: "Monthly Library",
        address: "100 Monthly St",
        lat: 0,
        lng: 0,
        contactPhone: "+1000000010",
        operatingHours: {},
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 0,
        managedByUserId: uid,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
      return { userId: uid, locationId: locId };
    });

    // Create a completed read in January 2026
    await t.run(async (ctx) => {
      const bookId = await ctx.db.insert("books", {
        title: "Jan Book",
        author: "Author",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 200,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
      });
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locationId,
        pickedUpAt: new Date(2026, 0, 5).getTime(),
        returnedAt: new Date(2026, 0, 25).getTime(),
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    // Set a monthly goal for January: 2 books
    await authed.mutation(api.readingGoals.setMonthlyGoal, {
      year: 2026,
      month: 1,
      targetBooks: 2,
    });

    const monthly = await authed.query(api.readingGoals.getMonthlyProgress, {
      year: 2026,
    });
    expect(monthly).not.toBeNull();
    expect(monthly!.months).toHaveLength(12);

    // January: 1 read out of 2 target = 50%
    const jan = monthly!.months[0];
    expect(jan.month).toBe(1);
    expect(jan.targetBooks).toBe(2);
    expect(jan.completedReads).toBe(1);
    expect(jan.progressPercent).toBe(50);

    // February: no goal, no reads
    const feb = monthly!.months[1];
    expect(feb.targetBooks).toBeNull();
    expect(feb.completedReads).toBe(0);
    expect(feb.progressPercent).toBeNull();

    // Update the monthly goal
    await authed.mutation(api.readingGoals.setMonthlyGoal, {
      year: 2026,
      month: 1,
      targetBooks: 1,
    });
    const updated = await authed.query(api.readingGoals.getMonthlyProgress, {
      year: 2026,
    });
    expect(updated!.months[0].targetBooks).toBe(1);
    expect(updated!.months[0].progressPercent).toBe(100);

    // Remove monthly goal
    await authed.mutation(api.readingGoals.removeMonthlyGoal, {
      year: 2026,
      month: 1,
    });
    const removed = await authed.query(api.readingGoals.getMonthlyProgress, {
      year: 2026,
    });
    expect(removed!.months[0].targetBooks).toBeNull();
  });

  it("monthly goals don't interfere with annual goals", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    // Set annual goal
    await authed.mutation(api.readingGoals.setGoal, {
      year: 2026,
      targetBooks: 24,
    });

    // Set monthly goal for March
    await authed.mutation(api.readingGoals.setMonthlyGoal, {
      year: 2026,
      month: 3,
      targetBooks: 3,
    });

    // Annual goal should still be 24
    const annual = await authed.query(api.readingGoals.getProgress, {
      year: 2026,
    });
    expect(annual!.targetBooks).toBe(24);

    // Monthly goals should show March=3, others null
    const monthly = await authed.query(api.readingGoals.getMonthlyProgress, {
      year: 2026,
    });
    expect(monthly!.months[2].targetBooks).toBe(3);
    expect(monthly!.months[0].targetBooks).toBeNull();
  });

  it("removeGoal rejects invalid year", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    await expect(
      authed.mutation(api.readingGoals.removeGoal, { year: 1999 }),
    ).rejects.toThrow("Invalid year");
  });

  it("removeMonthlyGoal rejects invalid month", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    await expect(
      authed.mutation(api.readingGoals.removeMonthlyGoal, {
        year: 2026,
        month: 13,
      }),
    ).rejects.toThrow("Month must be between 1 and 12");
  });

  it("progressPercent caps at 100 when goal is exceeded", async () => {
    const t = convexTest(schema, modules);

    const { userId, locationId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", {
        name: "Library",
        address: "456 Oak Ave",
        lat: 0,
        lng: 0,
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
      return { userId: uid, locationId: locId };
    });

    await t.run(async (ctx) => {
      const bookId = await ctx.db.insert("books", {
        title: "Quick Read",
        author: "Fast Author",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 50,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });

      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
      });

      // 3 completed reads — goal is only 2
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("journeyEntries", {
          copyId,
          readerId: userId,
          pickupLocationId: locationId,
          pickedUpAt: new Date(2026, i, 1).getTime(),
          returnedAt: new Date(2026, i, 15).getTime(),
          conditionAtPickup: "good",
          conditionAtReturn: "good",
          pickupPhotos: [],
          returnPhotos: [],
        });
      }
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    await authed.mutation(api.readingGoals.setGoal, {
      year: 2026,
      targetBooks: 2,
    });

    const progress = await authed.query(api.readingGoals.getProgress, {
      year: 2026,
    });
    expect(progress!.completedReads).toBe(3);
    expect(progress!.progressPercent).toBe(100);
  });

  it("setMonthlyGoal rejects invalid target", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    await expect(
      authed.mutation(api.readingGoals.setMonthlyGoal, { year: 2026, month: 3, targetBooks: 0 }),
    ).rejects.toThrow("Monthly target must be between 1 and 100");

    await expect(
      authed.mutation(api.readingGoals.setMonthlyGoal, { year: 2026, month: 3, targetBooks: 101 }),
    ).rejects.toThrow("Monthly target must be between 1 and 100");
  });

  it("setMonthlyGoal rejects invalid month", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_goal1" });

    await expect(
      authed.mutation(api.readingGoals.setMonthlyGoal, { year: 2026, month: 0, targetBooks: 5 }),
    ).rejects.toThrow("Month must be between 1 and 12");

    await expect(
      authed.mutation(api.readingGoals.setMonthlyGoal, { year: 2026, month: 13, targetBooks: 5 }),
    ).rejects.toThrow("Month must be between 1 and 12");
  });
});
