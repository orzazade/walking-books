import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_loc1",
    phone: "+1234567890",
    name: "Test User",
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

function makeBook(overrides: Record<string, unknown> = {}) {
  return {
    title: "Test Book",
    author: "Author",
    isbn: "1234567890",
    categories: ["fiction"],
    language: "en",
    description: "A test book",
    coverImage: "",
    avgRating: 0,
    reviewCount: 0,
    pageCount: 200,
    ...overrides,
  };
}

describe("partnerLocations.update", () => {
  it("manager can update location name and address", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "mgr_upd", phone: "+3000000000", name: "Manager" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const manager = t.withIdentity({ subject: "mgr_upd" });
    await manager.mutation(api.partnerLocations.update, {
      locationId,
      name: "Updated Library",
      address: "456 New St",
    });

    const loc = await t.run(async (ctx) => ctx.db.get(locationId));
    expect(loc!.name).toBe("Updated Library");
    expect(loc!.address).toBe("456 New St");
  });

  it("non-manager cannot update location", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "mgr_upd2", phone: "+3000000001", name: "Manager" }));
      await ctx.db.insert("users", makeUser({ clerkId: "reader_upd", phone: "+3000000002", name: "Reader" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const reader = t.withIdentity({ subject: "reader_upd" });
    await expect(
      reader.mutation(api.partnerLocations.update, {
        locationId,
        name: "Hacked Name",
      }),
    ).rejects.toThrow("Only the manager can update location settings");
  });

  it("rejects empty name and validates shelf capacity", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "mgr_upd3", phone: "+3000000003", name: "Manager" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const manager = t.withIdentity({ subject: "mgr_upd3" });

    await expect(
      manager.mutation(api.partnerLocations.update, { locationId, name: "   " }),
    ).rejects.toThrow("Location name cannot be empty");

    await expect(
      manager.mutation(api.partnerLocations.update, { locationId, shelfCapacity: -1 }),
    ).rejects.toThrow("Shelf capacity must be a non-negative integer");
  });

  it("rejects name over 200 characters and address over 500 characters", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "mgr_upd4", phone: "+3000000004", name: "Manager" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const manager = t.withIdentity({ subject: "mgr_upd4" });

    await expect(
      manager.mutation(api.partnerLocations.update, { locationId, name: "A".repeat(201) }),
    ).rejects.toThrow("Location name must be 200 characters or less");

    await expect(
      manager.mutation(api.partnerLocations.update, { locationId, address: "B".repeat(501) }),
    ).rejects.toThrow("Address must be 500 characters or less");
  });
});

describe("partnerLocations.popularBooks", () => {
  it("returns top books ranked by pickup count at a location", async () => {
    const t = convexTest(schema, modules);

    let locId: any;

    await t.run(async (ctx) => {
      const managerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "mgr_pop", phone: "+2000000000", name: "Manager" }),
      );
      const readerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "rdr_pop", phone: "+2000000001", name: "Reader" }),
      );

      locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(managerId as unknown as string, { name: "Popular Cafe" }),
      );

      const bookA = await ctx.db.insert("books", makeBook({ title: "Popular Book" }));
      const bookB = await ctx.db.insert("books", makeBook({ title: "Less Popular", isbn: "9999999999" }));

      const copyA = await ctx.db.insert("copies", {
        bookId: bookA,
        status: "available",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: managerId,
        currentLocationId: locId,
        qrCodeUrl: "qr_pop1",
      });

      const copyB = await ctx.db.insert("copies", {
        bookId: bookB,
        status: "available",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: managerId,
        currentLocationId: locId,
        qrCodeUrl: "qr_pop2",
      });

      const now = Date.now();

      // Book A picked up 3 times at this location
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("journeyEntries", {
          copyId: copyA,
          readerId,
          pickupLocationId: locId,
          pickedUpAt: now - (i + 1) * 86400000,
          conditionAtPickup: "good",
          pickupPhotos: [],
          returnPhotos: [],
        });
      }

      // Book B picked up 1 time at this location
      await ctx.db.insert("journeyEntries", {
        copyId: copyB,
        readerId,
        pickupLocationId: locId,
        pickedUpAt: now - 86400000,
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const results = await t.query(api.partnerLocations.popularBooks, {
      locationId: locId,
    });

    expect(results).toHaveLength(2);
    // Most popular first
    expect(results[0].title).toBe("Popular Book");
    expect(results[0].pickupCount).toBe(3);
    expect(results[1].title).toBe("Less Popular");
    expect(results[1].pickupCount).toBe(1);
  });

  it("returns empty array when no pickups at location", async () => {
    const t = convexTest(schema, modules);

    let locId: any;

    await t.run(async (ctx) => {
      const managerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "mgr_empty", phone: "+3000000000", name: "Manager" }),
      );
      locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(managerId as unknown as string, { name: "Empty Cafe" }),
      );
    });

    const results = await t.query(api.partnerLocations.popularBooks, {
      locationId: locId,
    });

    expect(results).toHaveLength(0);
  });
});

describe("partnerLocations.locationStats", () => {
  it("aggregates pickup, return, and reader stats for a location", async () => {
    const t = convexTest(schema, modules);

    let locId: any;

    await t.run(async (ctx) => {
      const managerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "mgr_stats", phone: "+4000000000", name: "Manager" }),
      );
      const reader1 = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "rdr_stats1", phone: "+4000000001", name: "Reader 1" }),
      );
      const reader2 = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "rdr_stats2", phone: "+4000000002", name: "Reader 2" }),
      );

      locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(managerId as unknown as string, { name: "Stats Cafe" }),
      );

      const bookId = await ctx.db.insert("books", makeBook({ title: "Stats Book" }));
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: managerId,
        currentLocationId: locId,
        qrCodeUrl: "qr_stats",
      });

      const now = Date.now();

      // Reader 1: picked up 3 days ago, returned 1 day ago (2-day lending)
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: reader1,
        pickupLocationId: locId,
        pickedUpAt: now - 3 * 86400000,
        returnedAt: now - 1 * 86400000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Reader 2: picked up 2 days ago, not yet returned
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: reader2,
        pickupLocationId: locId,
        pickedUpAt: now - 2 * 86400000,
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const stats = await t.query(api.partnerLocations.locationStats, {
      locationId: locId,
    });

    expect(stats.totalPickups).toBe(2);
    expect(stats.totalReturns).toBe(1);
    expect(stats.uniqueReaders).toBe(2);
    expect(stats.pickupsLast30).toBe(2);
    expect(stats.avgLendingDays).toBe(2);
    expect(stats.weeklyPickups).toHaveLength(4);
  });
});

describe("partnerLocations.nearby", () => {
  it("returns locations sorted by distance with available book counts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const managerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "manager1", phone: "+1111111111", name: "Manager" }),
      );

      // Location A: close (40.7128, -74.006 — NYC)
      const locA = await ctx.db.insert(
        "partnerLocations",
        makeLocation(managerId as unknown as string, {
          name: "NYC Cafe",
          lat: 40.7128,
          lng: -74.006,
        }),
      );

      // Location B: far (34.0522, -118.2437 — LA)
      const locB = await ctx.db.insert(
        "partnerLocations",
        makeLocation(managerId as unknown as string, {
          name: "LA Bookshop",
          lat: 34.0522,
          lng: -118.2437,
        }),
      );

      // Add a book with an available copy at location A
      const bookId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: managerId,
        currentLocationId: locA,
        qrCodeUrl: "qr1",
      });

      // Add a checked-out copy at location B (should NOT count)
      await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: managerId,
        currentLocationId: locB,
        currentHolderId: managerId,
        qrCodeUrl: "qr2",
      });
    });

    // Query from near NYC (40.71, -74.0)
    const results = await t.query(api.partnerLocations.nearby, {
      lat: 40.71,
      lng: -74.0,
    });

    expect(results).toHaveLength(2);
    // NYC should be first (closer)
    expect(results[0].name).toBe("NYC Cafe");
    expect(results[0].availableBooks).toBe(1);
    expect(results[0].distanceKm).toBeLessThan(5);
    // LA should be second (farther)
    expect(results[1].name).toBe("LA Bookshop");
    expect(results[1].availableBooks).toBe(0);
    expect(results[1].distanceKm).toBeGreaterThan(3000);
  });
});
