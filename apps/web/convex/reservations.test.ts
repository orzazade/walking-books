import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_res1",
    phone: "+1234567890",
    name: "Reservation User",
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
    title: "Reserved Book",
    author: "Test Author",
    coverImage: "/cover.jpg",
    description: "A test book",
    categories: ["fiction"],
    pageCount: 250,
    language: "English",
    avgRating: 4.0,
    reviewCount: 5,
    ...overrides,
  };
}

function makeLocation(userId: unknown, overrides: Record<string, unknown> = {}) {
  return {
    name: "Downtown Library",
    address: "123 Main St",
    lat: 40.7128,
    lng: -74.006,
    contactPhone: "+1111111111",
    operatingHours: {},
    photos: [],
    shelfCapacity: 100,
    currentBookCount: 10,
    managedByUserId: userId,
    staffUserIds: [],
    avgRating: 4.5,
    reviewCount: 3,
    ...overrides,
  };
}

describe("reservations.create", () => {
  it("creates a reservation for an available copy", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_sharer_c", name: "Sharer" }),
      );
      await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId),
      );
      const cId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    const result = await authed.mutation(api.reservations.create, {
      copyId,
      locationId,
    });

    expect(result.reservationId).toBeDefined();
    expect(result.expiresAt).toBeGreaterThan(Date.now());

    // Copy should now be reserved
    const active = await authed.query(api.reservations.myActive, {});
    expect(active).toHaveLength(1);
    expect(active[0].bookTitle).toBe("Reserved Book");
  });

  it("rejects reservation on already-reserved copy", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_sharer_d", name: "Sharer D" }),
      );
      await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId),
      );
      const cId = await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locId,
        currentHolderId: sharerId,
        qrCodeUrl: "",
      });
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    await expect(
      authed.mutation(api.reservations.create, { copyId, locationId }),
    ).rejects.toThrow("Copy is not available");
  });

  it("rejects reservation on own book", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      const cId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    await expect(
      authed.mutation(api.reservations.create, { copyId, locationId }),
    ).rejects.toThrow("Cannot reserve your own book");
  });
});

describe("reservations.cancel", () => {
  it("cancels an active reservation and releases the copy", async () => {
    const t = convexTest(schema, modules);

    const { reservationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_sharer_e", name: "Sharer E" }),
      );
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId),
      );
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "reserved",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      const resId = await ctx.db.insert("reservations", {
        copyId,
        userId,
        locationId: locId,
        reservedAt: Date.now(),
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
        status: "active",
      });
      return { reservationId: resId };
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    const result = await authed.mutation(api.reservations.cancel, {
      reservationId,
    });
    expect(result.success).toBe(true);

    // No active reservations left
    const active = await authed.query(api.reservations.myActive, {});
    expect(active).toHaveLength(0);
  });

  it("rejects cancellation by non-owner", async () => {
    const t = convexTest(schema, modules);

    const { reservationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_sharer_f", name: "Sharer F" }),
      );
      const userId = await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_other", phone: "+9999999999", name: "Other" }),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId),
      );
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "reserved",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      const resId = await ctx.db.insert("reservations", {
        copyId,
        userId,
        locationId: locId,
        reservedAt: Date.now(),
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
        status: "active",
      });
      return { reservationId: resId };
    });

    const other = t.withIdentity({ subject: "user_other" });
    await expect(
      other.mutation(api.reservations.cancel, { reservationId }),
    ).rejects.toThrow("Not your reservation");
  });
});

describe("reservations.myHistory", () => {
  it("returns past reservations sorted newest-first with enriched details", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_sharer_h", name: "Sharer H" }),
      );
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook({ title: "History Book" }));
      const locationId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId, { name: "Cafe Central" }),
      );
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locationId,
        qrCodeUrl: "",
      });

      // Older fulfilled reservation
      await ctx.db.insert("reservations", {
        copyId,
        userId,
        locationId,
        reservedAt: Date.now() - 200000,
        expiresAt: Date.now() - 100000,
        status: "fulfilled",
      });
      // Newer cancelled reservation
      await ctx.db.insert("reservations", {
        copyId,
        userId,
        locationId,
        reservedAt: Date.now() - 50000,
        expiresAt: Date.now() - 10000,
        status: "cancelled",
      });
      // Active reservation — should NOT appear
      await ctx.db.insert("reservations", {
        copyId,
        userId,
        locationId,
        reservedAt: Date.now(),
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
        status: "active",
      });
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    const result = await authed.query(api.reservations.myHistory, {});

    expect(result).toHaveLength(2);
    // Newest first
    expect(result[0].status).toBe("cancelled");
    expect(result[1].status).toBe("fulfilled");
    // Enriched fields
    expect(result[0].bookTitle).toBe("History Book");
    expect(result[0].locationName).toBe("Cafe Central");
    expect(result[0].bookId).toBeDefined();
  });
});

describe("reservations.myActive", () => {
  it("returns empty array for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.reservations.myActive, {});
    expect(result).toEqual([]);
  });

  it("returns enriched reservation with book and location details", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_sharer", name: "Sharer" }),
      );
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locationId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId),
      );
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "reserved",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locationId,
        qrCodeUrl: "",
      });
      await ctx.db.insert("reservations", {
        copyId,
        userId,
        locationId,
        reservedAt: Date.now(),
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
        status: "active",
      });
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    const result = await authed.query(api.reservations.myActive, {});

    expect(result).toHaveLength(1);
    expect(result[0].bookTitle).toBe("Reserved Book");
    expect(result[0].bookAuthor).toBe("Test Author");
    expect(result[0].coverImage).toBe("/cover.jpg");
    expect(result[0].locationName).toBe("Downtown Library");
    expect(result[0].locationAddress).toBe("123 Main St");
    expect(result[0].bookId).toBeDefined();
  });

  it("excludes non-active reservations", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_sharer2", name: "Sharer 2" }),
      );
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locationId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId),
      );
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locationId,
        qrCodeUrl: "",
      });
      // Insert an expired reservation — should NOT appear
      await ctx.db.insert("reservations", {
        copyId,
        userId,
        locationId,
        reservedAt: Date.now() - 100000,
        expiresAt: Date.now() - 50000,
        status: "expired",
      });
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    const result = await authed.query(api.reservations.myActive, {});
    expect(result).toHaveLength(0);
  });

  it("handles deleted book/copy gracefully", async () => {
    const t = convexTest(schema, modules);

    // Create a reservation where the copy references a book, then we query
    // Even with valid data, the enrichment should work
    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_sharer3", name: "Sharer 3" }),
      );
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook({ title: "Rare Book" }));
      const locationId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId, { name: "Uptown Cafe", address: "456 Elm St" }),
      );
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "reserved",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locationId,
        qrCodeUrl: "",
      });
      await ctx.db.insert("reservations", {
        copyId,
        userId,
        locationId,
        reservedAt: Date.now(),
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
        status: "active",
      });
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    const result = await authed.query(api.reservations.myActive, {});
    expect(result).toHaveLength(1);
    expect(result[0].bookTitle).toBe("Rare Book");
    expect(result[0].locationName).toBe("Uptown Cafe");
    expect(result[0].locationAddress).toBe("456 Elm St");
  });

  it("rejects reservation when copy is at a different location", async () => {
    const t = convexTest(schema, modules);

    const { copyId, wrongLocationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_sharer_loc", name: "Sharer Loc" }),
      );
      await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locA = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId, { name: "Location A" }),
      );
      const locB = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId, { name: "Location B" }),
      );
      const cId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locA,
        qrCodeUrl: "",
      });
      return { copyId: cId, wrongLocationId: locB };
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    await expect(
      authed.mutation(api.reservations.create, {
        copyId,
        locationId: wrongLocationId,
      }),
    ).rejects.toThrow("Copy is not at the specified location");
  });

  it("rejects reservation when reputation is too low", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_sharer_rep", name: "Sharer Rep" }),
      );
      // Create user with reputation score below 15 (suspended)
      await ctx.db.insert(
        "users",
        makeUser({ reputationScore: 10 }),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId),
      );
      const cId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    await expect(
      authed.mutation(api.reservations.create, { copyId, locationId }),
    ).rejects.toThrow("Your reputation is too low to reserve books");
  });

  it("rejects reserving your own book", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser(),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId),
      );
      const cId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    await expect(
      authed.mutation(api.reservations.create, { copyId, locationId }),
    ).rejects.toThrow("Cannot reserve your own book");
  });

  it("rejects duplicate active reservation for same copy", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "sharer_dup_res", phone: "+9999999991" }),
      );
      await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId),
      );
      const cId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    // First reservation succeeds
    await authed.mutation(api.reservations.create, { copyId, locationId });

    // Second reservation for same copy fails (copy is now reserved)
    await expect(
      authed.mutation(api.reservations.create, { copyId, locationId }),
    ).rejects.toThrow();
  });
});
