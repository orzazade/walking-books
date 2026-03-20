import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_cs1",
    phone: "+1234567890",
    name: "Community User",
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

describe("communityStats", () => {
  it("returns zeros when database is empty", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.communityStats.getStats, {});
    expect(result.totalBooks).toBe(0);
    expect(result.totalCopies).toBe(0);
    expect(result.availableCopies).toBe(0);
    expect(result.checkedOutCopies).toBe(0);
    expect(result.totalSharers).toBe(0);
    expect(result.totalReaders).toBe(0);
    expect(result.completedReads).toBe(0);
    expect(result.recentPickups).toBe(0);
    expect(result.recentReturns).toBe(0);
    expect(result.totalReviews).toBe(0);
    expect(result.totalLocations).toBe(0);
    expect(result.topLocation).toBeNull();
    expect(result.topGenre).toBeNull();
  });

  it("counts books, copies, and locations", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      await ctx.db.insert("books", makeBook({ title: "Book 1" }));
      await ctx.db.insert("books", makeBook({ title: "Book 2", categories: ["mystery"] }));
      const bookId = (await ctx.db.query("books").first())!._id;
      await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        qrCodeUrl: "",
      });
      await ctx.db.insert("partnerLocations", makeLocation(userId as string));
    });

    const result = await t.query(api.communityStats.getStats, {});
    expect(result.totalBooks).toBe(2);
    expect(result.totalCopies).toBe(1);
    expect(result.availableCopies).toBe(1);
    expect(result.totalLocations).toBe(1);
    expect(result.totalSharers).toBe(1);
  });

  it("counts completed reads and unique readers", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      const user1 = await ctx.db.insert("users", makeUser());
      const user2 = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_cs2", phone: "+2222222222", name: "User 2" }),
      );
      const locId = await ctx.db.insert("partnerLocations", makeLocation(user1 as string));
      const bookId = await ctx.db.insert("books", makeBook());
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: user1,
        currentLocationId: locId,
        qrCodeUrl: "",
      });

      // 2 completed reads by 2 different users
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: user1,
        pickupLocationId: locId,
        pickedUpAt: now - 10 * 86_400_000,
        returnedAt: now - 5 * 86_400_000,
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: user2,
        pickupLocationId: locId,
        pickedUpAt: now - 4 * 86_400_000,
        returnedAt: now - 1 * 86_400_000,
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });

      // 1 in-progress read (no returnedAt) — should not count
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: user1,
        pickupLocationId: locId,
        pickedUpAt: now,
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
    });

    const result = await t.query(api.communityStats.getStats, {});
    expect(result.completedReads).toBe(2);
    expect(result.totalReaders).toBe(2);
  });

  it("tracks recent activity (last 30 days)", async () => {
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

      // Recent pickup + return (within 30 days)
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: now - 5 * 86_400_000,
        returnedAt: now - 2 * 86_400_000,
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });

      // Old pickup + return (beyond 30 days)
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: now - 60 * 86_400_000,
        returnedAt: now - 50 * 86_400_000,
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
    });

    const result = await t.query(api.communityStats.getStats, {});
    expect(result.recentPickups).toBe(1);
    expect(result.recentReturns).toBe(1);
    expect(result.completedReads).toBe(2); // all-time
  });

  it("identifies most active location", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const loc1 = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as string, { name: "Popular Cafe", address: "1 Main St" }),
      );
      const loc2 = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as string, { name: "Quiet Library", address: "2 Elm St" }),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: loc1,
        qrCodeUrl: "",
      });

      // 3 pickups at loc1
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("journeyEntries", {
          copyId,
          readerId: userId,
          pickupLocationId: loc1,
          pickedUpAt: now - i * 86_400_000,
          pickupPhotos: [],
          returnPhotos: [],
          conditionAtPickup: "good" as const,
        });
      }

      // 1 pickup at loc2
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: loc2,
        pickedUpAt: now - 86_400_000,
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
    });

    const result = await t.query(api.communityStats.getStats, {});
    expect(result.topLocation).not.toBeNull();
    expect(result.topLocation!.name).toBe("Popular Cafe");
    expect(result.topLocation!.pickups).toBe(3);
  });

  it("identifies top genre", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("books", makeBook({ categories: ["fiction", "drama"] }));
      await ctx.db.insert("books", makeBook({ title: "Book 2", categories: ["fiction"] }));
      await ctx.db.insert("books", makeBook({ title: "Book 3", categories: ["mystery"] }));
    });

    const result = await t.query(api.communityStats.getStats, {});
    expect(result.topGenre).toBe("fiction");
  });

  it("counts reviews", async () => {
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
      await ctx.db.insert("reviews", {
        bookId,
        userId,
        rating: 5,
        text: "Loved it!",
      });
    });

    const result = await t.query(api.communityStats.getStats, {});
    expect(result.totalReviews).toBe(2);
  });

  it("distinguishes available vs checked-out copies", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());

      await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
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
      await ctx.db.insert("copies", {
        bookId,
        status: "reserved" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        qrCodeUrl: "",
      });
    });

    const result = await t.query(api.communityStats.getStats, {});
    expect(result.totalCopies).toBe(3);
    expect(result.availableCopies).toBe(1);
    expect(result.checkedOutCopies).toBe(1);
  });

  it("works without authentication (public query)", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("books", makeBook());
    });

    // No withIdentity — should work for anonymous users
    const result = await t.query(api.communityStats.getStats, {});
    expect(result.totalBooks).toBe(1);
  });
});

describe("communityStats.recentActivity", () => {
  it("returns recent pickups with book, reader, and location details", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser({
        clerkId: "activity_user",
        name: "Active Reader",
        avatarUrl: "https://example.com/avatar.jpg",
      }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId as unknown as string, {
        name: "Cozy Cafe",
      }));
      const bookId = await ctx.db.insert("books", makeBook({
        title: "The Great Novel",
        author: "Famous Author",
        coverImage: "https://example.com/cover.jpg",
      }));
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
        currentHolderId: userId,
      });
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: now - 3600000, // 1 hour ago
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const result = await t.query(api.communityStats.recentActivity, {});
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("pickup");
    expect(result[0].bookTitle).toBe("The Great Novel");
    expect(result[0].bookAuthor).toBe("Famous Author");
    expect(result[0].readerName).toBe("Active Reader");
    expect(result[0].locationName).toBe("Cozy Cafe");
    expect(result[0].coverImage).toBe("https://example.com/cover.jpg");
    expect(result[0]).toHaveProperty("bookId");
    expect(result[0]).toHaveProperty("readerId");
    expect(result[0]).toHaveProperty("timestamp");
  });

  it("returns empty array when no recent activity", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.communityStats.recentActivity, {});
    expect(result).toEqual([]);
  });

  it("marks returned entries as type return", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser({ clerkId: "return_user" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId as unknown as string));
      const bookId = await ctx.db.insert("books", makeBook());
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
        currentLocationId: locId,
      });
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: now - 7200000,
        returnedAt: now - 3600000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const result = await t.query(api.communityStats.recentActivity, {});
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("return");
  });
});
