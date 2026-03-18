import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_feed1",
    phone: "+1234567890",
    name: "Feed User",
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
    address: "123 Main St",
    lat: 0,
    lng: 0,
    contactPhone: "+1111111111",
    operatingHours: {},
    photos: [],
    shelfCapacity: 100,
    currentBookCount: 0,
    managedByUserId,
    staffUserIds: [],
    ...overrides,
  };
}

describe("activityFeed", () => {
  it("returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.activityFeed.feed, {});
    expect(result).toEqual([]);
  });

  it("returns empty when user follows nobody", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_feed1" });
    const result = await authed.query(api.activityFeed.feed, {});
    expect(result).toEqual([]);
  });

  it("shows pickup events from followed users", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const viewerId = await ctx.db.insert("users", makeUser());
      const friendId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_feed2", name: "Friend", phone: "+9999999999" }),
      );
      const bookId = await ctx.db.insert("books", makeBook({ title: "Great Novel" }));
      const locationId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(viewerId as unknown as string, { name: "Downtown Library" }),
      );
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "checked_out" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: friendId,
        currentHolderId: friendId,
        qrCodeUrl: "qr://test",
      });

      // Friend picked up a book
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: friendId,
        pickupLocationId: locationId,
        pickedUpAt: Date.now() - 86400000,
        conditionAtPickup: "good" as const,
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Viewer follows friend
      await ctx.db.insert("follows", {
        followerId: viewerId,
        followingId: friendId,
      });
    });

    const authed = t.withIdentity({ subject: "user_feed1" });
    const result = await authed.query(api.activityFeed.feed, {});

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("pickup");
    expect(result[0].book.title).toBe("Great Novel");
    expect(result[0].user.name).toBe("Friend");
    expect(result[0].detail.locationName).toBe("Downtown Library");
  });

  it("shows return events from followed users", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const viewerId = await ctx.db.insert("users", makeUser());
      const friendId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_feed2", name: "Friend", phone: "+9999999999" }),
      );
      const bookId = await ctx.db.insert("books", makeBook({ title: "Returned Book" }));
      const locationId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(viewerId as unknown as string),
      );
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: friendId,
        qrCodeUrl: "qr://test",
      });

      // Friend picked up and returned a book
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: friendId,
        pickupLocationId: locationId,
        dropoffLocationId: locationId,
        pickedUpAt: Date.now() - 172800000,
        returnedAt: Date.now() - 86400000,
        conditionAtPickup: "good" as const,
        conditionAtReturn: "good" as const,
        pickupPhotos: [],
        returnPhotos: [],
      });

      await ctx.db.insert("follows", {
        followerId: viewerId,
        followingId: friendId,
      });
    });

    const authed = t.withIdentity({ subject: "user_feed1" });
    const result = await authed.query(api.activityFeed.feed, {});

    // Should have both pickup and return events
    expect(result).toHaveLength(2);
    const types = result.map((r: { type: string }) => r.type);
    expect(types).toContain("pickup");
    expect(types).toContain("return");
    // Return should be first (more recent)
    expect(result[0].type).toBe("return");
  });

  it("shows review events from followed users", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const viewerId = await ctx.db.insert("users", makeUser());
      const friendId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_feed2", name: "Reviewer", phone: "+9999999999" }),
      );
      const bookId = await ctx.db.insert(
        "books",
        makeBook({ title: "Reviewed Book", reviewCount: 1, avgRating: 4 }),
      );

      await ctx.db.insert("reviews", {
        bookId,
        userId: friendId,
        rating: 4,
        text: "Loved this book!",
      });

      await ctx.db.insert("follows", {
        followerId: viewerId,
        followingId: friendId,
      });
    });

    const authed = t.withIdentity({ subject: "user_feed1" });
    const result = await authed.query(api.activityFeed.feed, {});

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("review");
    expect(result[0].book.title).toBe("Reviewed Book");
    expect(result[0].user.name).toBe("Reviewer");
    expect(result[0].detail.rating).toBe(4);
    expect(result[0].detail.reviewText).toBe("Loved this book!");
  });

  it("excludes activity from non-followed users", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const viewerId = await ctx.db.insert("users", makeUser());
      const strangerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_stranger", name: "Stranger", phone: "+8888888888" }),
      );
      const bookId = await ctx.db.insert("books", makeBook());

      // Stranger writes a review but viewer doesn't follow them
      await ctx.db.insert("reviews", {
        bookId,
        userId: strangerId,
        rating: 3,
        text: "It was okay",
      });
    });

    const authed = t.withIdentity({ subject: "user_feed1" });
    const result = await authed.query(api.activityFeed.feed, {});
    expect(result).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const viewerId = await ctx.db.insert("users", makeUser());
      const friendId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_feed2", name: "Prolific Reader", phone: "+9999999999" }),
      );

      await ctx.db.insert("follows", {
        followerId: viewerId,
        followingId: friendId,
      });

      // Friend reviews 5 books
      for (let i = 0; i < 5; i++) {
        const bookId = await ctx.db.insert(
          "books",
          makeBook({ title: `Book ${i}` }),
        );
        await ctx.db.insert("reviews", {
          bookId,
          userId: friendId,
          rating: 4,
          text: `Review ${i}`,
        });
      }
    });

    const authed = t.withIdentity({ subject: "user_feed1" });
    const result = await authed.query(api.activityFeed.feed, { limit: 3 });
    expect(result).toHaveLength(3);
  });
});
