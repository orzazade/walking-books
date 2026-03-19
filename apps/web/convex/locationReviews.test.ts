import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_lr1",
    phone: "+1234567890",
    name: "Reviewer One",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

function makeLocation(managerId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Library",
    address: "123 Main St",
    lat: 0,
    lng: 0,
    contactPhone: "+1000000000",
    operatingHours: {},
    photos: [],
    shelfCapacity: 50,
    currentBookCount: 0,
    managedByUserId: managerId,
    staffUserIds: [],
    avgRating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

describe("locationReviews", () => {
  it("create adds a review and updates location avgRating", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111", name: "Manager" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_lr1" });
    await authed.mutation(api.locationReviews.create, {
      locationId,
      rating: 4,
      text: "Great location, friendly staff!",
    });

    const reviews = await authed.query(api.locationReviews.byLocation, { locationId });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].rating).toBe(4);
    expect(reviews[0].text).toBe("Great location, friendly staff!");
    expect(reviews[0].userName).toBe("Reviewer One");

    // Check location aggregate was updated
    const loc = await t.run(async (ctx) => ctx.db.get(locationId));
    expect(loc!.avgRating).toBe(4);
    expect(loc!.reviewCount).toBe(1);
  });

  it("create upserts — updates existing review and recalculates average", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_lr1" });
    await authed.mutation(api.locationReviews.create, {
      locationId,
      rating: 3,
      text: "It was okay",
    });
    await authed.mutation(api.locationReviews.create, {
      locationId,
      rating: 5,
      text: "Actually, it's amazing!",
    });

    const reviews = await authed.query(api.locationReviews.byLocation, { locationId });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].rating).toBe(5);
    expect(reviews[0].text).toBe("Actually, it's amazing!");

    const loc = await t.run(async (ctx) => ctx.db.get(locationId));
    expect(loc!.avgRating).toBe(5);
    expect(loc!.reviewCount).toBe(1);
  });

  it("multiple reviewers produce correct average", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      await ctx.db.insert("users", makeUser({ clerkId: "user_lr2", phone: "+2222222222", name: "Reviewer Two" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const reviewer1 = t.withIdentity({ subject: "user_lr1" });
    const reviewer2 = t.withIdentity({ subject: "user_lr2" });

    await reviewer1.mutation(api.locationReviews.create, {
      locationId,
      rating: 4,
      text: "Good place",
    });
    await reviewer2.mutation(api.locationReviews.create, {
      locationId,
      rating: 2,
      text: "Could be better",
    });

    const loc = await t.run(async (ctx) => ctx.db.get(locationId));
    expect(loc!.avgRating).toBe(3);
    expect(loc!.reviewCount).toBe(2);
  });

  it("prevents manager from reviewing own location", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const authed = t.withIdentity({ subject: "manager1" });
    await expect(
      authed.mutation(api.locationReviews.create, {
        locationId,
        rating: 5,
        text: "Best place ever!",
      }),
    ).rejects.toThrow("You cannot review a location you manage or work at");
  });

  it("prevents staff from reviewing their location", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      const staffId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string, {
        staffUserIds: [staffId],
      }));
      return { locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_lr1" });
    await expect(
      authed.mutation(api.locationReviews.create, {
        locationId,
        rating: 5,
        text: "We are great!",
      }),
    ).rejects.toThrow("You cannot review a location you manage or work at");
  });

  it("validates rating is integer 1-5", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_lr1" });

    await expect(
      authed.mutation(api.locationReviews.create, { locationId, rating: 0, text: "Bad" }),
    ).rejects.toThrow("Rating must be an integer between 1 and 5");

    await expect(
      authed.mutation(api.locationReviews.create, { locationId, rating: 6, text: "Too good" }),
    ).rejects.toThrow("Rating must be an integer between 1 and 5");

    await expect(
      authed.mutation(api.locationReviews.create, { locationId, rating: 3.5, text: "Half" }),
    ).rejects.toThrow("Rating must be an integer between 1 and 5");
  });

  it("validates review text non-empty and max 5000 chars", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_lr1" });

    await expect(
      authed.mutation(api.locationReviews.create, { locationId, rating: 3, text: "   " }),
    ).rejects.toThrow("Review text is required");

    await expect(
      authed.mutation(api.locationReviews.create, { locationId, rating: 3, text: "x".repeat(5001) }),
    ).rejects.toThrow("Review text must be 5000 characters or less");
  });

  it("myReview returns current user review or null", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_lr1" });

    // No review yet
    const before = await authed.query(api.locationReviews.myReview, { locationId });
    expect(before).toBeNull();

    await authed.mutation(api.locationReviews.create, {
      locationId,
      rating: 4,
      text: "Nice spot",
    });

    const after = await authed.query(api.locationReviews.myReview, { locationId });
    expect(after).not.toBeNull();
    expect(after!.rating).toBe(4);
  });

  it("myReview returns null for unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const result = await t.query(api.locationReviews.myReview, { locationId });
    expect(result).toBeNull();
  });

  it("rejects unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    await expect(
      t.mutation(api.locationReviews.create, {
        locationId,
        rating: 4,
        text: "Good place",
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("throws on nonexistent location", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_lr1" });

    // Use a valid-format but nonexistent ID by creating and deleting
    const fakeId = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "tmp", phone: "+9999999999" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      await ctx.db.delete(locId);
      return locId;
    });

    await expect(
      authed.mutation(api.locationReviews.create, {
        locationId: fakeId,
        rating: 4,
        text: "Where is this?",
      }),
    ).rejects.toThrow("Location not found");
  });
});
