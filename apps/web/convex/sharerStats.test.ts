import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_sharer1",
    phone: "+1234567890",
    name: "Sharer User",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

function makeLocation(managedByUserId: string) {
  return {
    name: "Test Library",
    address: "1 Main St",
    lat: 0,
    lng: 0,
    contactPhone: "+1000000000",
    operatingHours: {},
    photos: [],
    shelfCapacity: 100,
    currentBookCount: 0,
    managedByUserId,
    staffUserIds: [],
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
    avgRating: 4,
    reviewCount: 0,
    ...overrides,
  };
}

describe("sharerStats", () => {
  it("returns null for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.sharerStats.getStats, {});
    expect(result).toBeNull();
  });

  it("returns zero stats for user who has not shared any books", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_sharer1" });
    const stats = await authed.query(api.sharerStats.getStats, {});

    expect(stats!.totalCopiesShared).toBe(0);
    expect(stats!.totalTimesLent).toBe(0);
    expect(stats!.currentlyLent).toBe(0);
    expect(stats!.uniqueReaders).toBe(0);
    expect(stats!.avgLendingDays).toBeNull();
    expect(stats!.mostPopularBook).toBeNull();
    expect(stats!.topLocations).toEqual([]);
  });

  it("computes correct sharing stats with journey history", async () => {
    const t = convexTest(schema, modules);

    const ids = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ booksShared: 2 }));
      const reader1Id = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "reader1", name: "Reader 1", phone: "+1111111111" }),
      );
      const reader2Id = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "reader2", name: "Reader 2", phone: "+2222222222" }),
      );

      const locationId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId as unknown as string),
      );

      const book1Id = await ctx.db.insert("books", makeBook({ title: "Popular Book", author: "Author A" }));
      const book2Id = await ctx.db.insert("books", makeBook({ title: "Niche Book", author: "Author B" }));

      const copy1 = await ctx.db.insert("copies", {
        bookId: book1Id,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locationId,
        qrCodeUrl: "",
      });

      const copy2 = await ctx.db.insert("copies", {
        bookId: book2Id,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: sharerId,
        currentHolderId: reader2Id,
        qrCodeUrl: "",
      });

      // copy1 was borrowed and returned twice (by reader1 and reader2)
      await ctx.db.insert("journeyEntries", {
        copyId: copy1,
        readerId: reader1Id,
        pickupLocationId: locationId,
        pickedUpAt: new Date(2026, 0, 1).getTime(),
        returnedAt: new Date(2026, 0, 11).getTime(), // 10 days
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      await ctx.db.insert("journeyEntries", {
        copyId: copy1,
        readerId: reader2Id,
        pickupLocationId: locationId,
        pickedUpAt: new Date(2026, 1, 1).getTime(),
        returnedAt: new Date(2026, 1, 21).getTime(), // 20 days
        conditionAtPickup: "good",
        conditionAtReturn: "fair",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // copy2 is currently checked out (no returnedAt)
      await ctx.db.insert("journeyEntries", {
        copyId: copy2,
        readerId: reader2Id,
        pickupLocationId: locationId,
        pickedUpAt: new Date(2026, 2, 1).getTime(),
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      return { sharerId, locationId };
    });

    const authed = t.withIdentity({ subject: "user_sharer1" });
    const stats = await authed.query(api.sharerStats.getStats, {});

    expect(stats!.totalCopiesShared).toBe(2);
    expect(stats!.totalTimesLent).toBe(3); // 2 completed + 1 in progress
    expect(stats!.currentlyLent).toBe(1);
    expect(stats!.uniqueReaders).toBe(2);
    expect(stats!.avgLendingDays).toBe(15); // (10 + 20) / 2
    expect(stats!.mostPopularBook).toEqual({
      title: "Popular Book",
      author: "Author A",
      timesLent: 2,
    });
    expect(stats!.topLocations).toHaveLength(1);
    expect(stats!.topLocations[0]!.name).toBe("Test Library");
    expect(stats!.topLocations[0]!.count).toBe(1); // only copy1 at location
  });

  it("allows viewing another user's sharer stats by userId", async () => {
    const t = convexTest(schema, modules);

    const targetUserId = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "viewer1", name: "Viewer", phone: "+9999999999" }),
      );

      const bookId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        qrCodeUrl: "",
      });

      return sharerId;
    });

    const viewer = t.withIdentity({ subject: "viewer1" });
    const stats = await viewer.query(api.sharerStats.getStats, {
      userId: targetUserId,
    });

    expect(stats).not.toBeNull();
    expect(stats!.totalCopiesShared).toBe(1);
    expect(stats!.totalTimesLent).toBe(0);
  });

  it("handles sharer with copies but no journeys", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ booksShared: 1 }));
      const bookId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_sharer1" });
    const stats = await authed.query(api.sharerStats.getStats, {});

    expect(stats!.totalCopiesShared).toBe(1);
    expect(stats!.totalTimesLent).toBe(0);
    expect(stats!.uniqueReaders).toBe(0);
    expect(stats!.avgLendingDays).toBeNull();
    expect(stats!.mostPopularBook).toBeNull();
  });
});
