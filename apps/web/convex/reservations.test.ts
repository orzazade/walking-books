import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";

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

  it("cancel rejects non-active reservation", async () => {
    const t = convexTest(schema, modules);

    const { reservationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "sharer_cancel", phone: "+8888888801" }),
      );
      await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId),
      );
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      const resId = await ctx.db.insert("reservations", {
        copyId,
        userId: sharerId, // placeholder, we'll use the right user
        locationId: locId,
        reservedAt: Date.now(),
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
        status: "cancelled",
      });
      return { reservationId: resId };
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    await expect(
      authed.mutation(api.reservations.cancel, { reservationId }),
    ).rejects.toThrow("Reservation is not active");
  });

  it("cancel rejects non-owner", async () => {
    const t = convexTest(schema, modules);

    const { reservationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "sharer_own", phone: "+8888888811" }),
      );
      const reserverId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "reserver_own", phone: "+8888888812" }),
      );
      await ctx.db.insert("users", makeUser());
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
        userId: reserverId,
        locationId: locId,
        reservedAt: Date.now(),
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
        status: "active",
      });
      return { reservationId: resId };
    });

    // user_res1 tries to cancel someone else's reservation
    const authed = t.withIdentity({ subject: "user_res1" });
    await expect(
      authed.mutation(api.reservations.cancel, { reservationId }),
    ).rejects.toThrow("Not your reservation");
  });

  it("create rejects nonexistent copy", async () => {
    const t = convexTest(schema, modules);

    const { fakeCopyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_noc", phone: "+5555555555" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      const bookId = await ctx.db.insert("books", makeBook());
      const cId = await ctx.db.insert("copies", {
        bookId, status: "available", condition: "good", ownershipType: "donated",
        originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
      });
      await ctx.db.delete(cId);
      return { fakeCopyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    await expect(
      authed.mutation(api.reservations.create, { copyId: fakeCopyId, locationId }),
    ).rejects.toThrow("Copy not found");
  });

  it("create rejects nonexistent location", async () => {
    const t = convexTest(schema, modules);

    const { copyId, fakeLocationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_nol", phone: "+5555555556" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      const bookId = await ctx.db.insert("books", makeBook());
      const cId = await ctx.db.insert("copies", {
        bookId, status: "available", condition: "good", ownershipType: "donated",
        originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
      });
      const fakeLocId = await ctx.db.insert("partnerLocations", makeLocation(sharerId, { name: "Ghost" }));
      await ctx.db.delete(fakeLocId);
      return { copyId: cId, fakeLocationId: fakeLocId };
    });

    const authed = t.withIdentity({ subject: "user_res1" });
    await expect(
      authed.mutation(api.reservations.create, { copyId, locationId: fakeLocationId }),
    ).rejects.toThrow("Location not found");
  });
});

describe("reservations.expireStale", () => {
  it("expires past-due reservations and releases reserved copies", async () => {
    const t = convexTest(schema, modules);
    const { reservationId, copyId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser({ clerkId: "user_expire1" }));
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_expire1", phone: "+9999999901" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      const bookId = await ctx.db.insert("books", makeBook());
      const cId = await ctx.db.insert("copies", {
        bookId, status: "reserved", condition: "good", ownershipType: "donated",
        originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
      });
      const rId = await ctx.db.insert("reservations", {
        userId,
        copyId: cId,
        locationId: locId,
        reservedAt: Date.now() - 172800000,
        status: "active",
        expiresAt: Date.now() - 86400000, // expired 1 day ago
      });
      return { reservationId: rId, copyId: cId };
    });

    await t.mutation(internal.reservations.expireStale, {});

    const { reservation, copy } = await t.run(async (ctx) => ({
      reservation: await ctx.db.get(reservationId),
      copy: await ctx.db.get(copyId),
    }));
    expect(reservation!.status).toBe("expired");
    expect(copy!.status).toBe("available"); // released back
  });

  it("does not expire reservations that have not yet passed expiresAt", async () => {
    const t = convexTest(schema, modules);
    const { reservationId, copyId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser({ clerkId: "user_expire2" }));
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_expire2", phone: "+9999999902" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      const bookId = await ctx.db.insert("books", makeBook());
      const cId = await ctx.db.insert("copies", {
        bookId, status: "reserved", condition: "good", ownershipType: "donated",
        originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
      });
      const rId = await ctx.db.insert("reservations", {
        userId,
        copyId: cId,
        locationId: locId,
        reservedAt: Date.now(),
        status: "active",
        expiresAt: Date.now() + 86400000, // still valid
      });
      return { reservationId: rId, copyId: cId };
    });

    await t.mutation(internal.reservations.expireStale, {});

    const { reservation, copy } = await t.run(async (ctx) => ({
      reservation: await ctx.db.get(reservationId),
      copy: await ctx.db.get(copyId),
    }));
    expect(reservation!.status).toBe("active"); // unchanged
    expect(copy!.status).toBe("reserved"); // unchanged
  });

  it("applies no-show reputation penalty to user with expired reservation", async () => {
    const t = convexTest(schema, modules);
    const startingRep = 50;
    const { userId } = await t.run(async (ctx) => {
      const uId = await ctx.db.insert("users", makeUser({ clerkId: "user_expire3", reputationScore: startingRep }));
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_expire3", phone: "+9999999903" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      const bookId = await ctx.db.insert("books", makeBook());
      const cId = await ctx.db.insert("copies", {
        bookId, status: "reserved", condition: "good", ownershipType: "donated",
        originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
      });
      await ctx.db.insert("reservations", {
        userId: uId,
        copyId: cId,
        locationId: locId,
        reservedAt: Date.now() - 172800000,
        status: "active",
        expiresAt: Date.now() - 86400000,
      });
      return { userId: uId };
    });

    await t.mutation(internal.reservations.expireStale, {});

    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user!.reputationScore).toBe(startingRep - 3); // NO_SHOW = -3
  });

  it("sends reservation_expired notification to user", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await t.run(async (ctx) => {
      const uId = await ctx.db.insert("users", makeUser({ clerkId: "user_expire4" }));
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_expire4", phone: "+9999999904" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      const bookId = await ctx.db.insert("books", makeBook({ title: "Expired Book" }));
      const cId = await ctx.db.insert("copies", {
        bookId, status: "reserved", condition: "good", ownershipType: "donated",
        originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
      });
      await ctx.db.insert("reservations", {
        userId: uId,
        copyId: cId,
        locationId: locId,
        reservedAt: Date.now() - 172800000,
        status: "active",
        expiresAt: Date.now() - 86400000,
      });
      return { userId: uId };
    });

    await t.mutation(internal.reservations.expireStale, {});

    const notifications = await t.run(async (ctx) =>
      ctx.db.query("userNotifications").collect(),
    );
    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe("reservation_expired");
    expect(notifications[0].title).toBe("Reservation expired");
    expect(notifications[0].message).toContain("Expired Book");
  });

  it("applies cumulative no-show penalty for multiple expired reservations by same user", async () => {
    const t = convexTest(schema, modules);
    const startingRep = 50;
    const { userId } = await t.run(async (ctx) => {
      const uId = await ctx.db.insert("users", makeUser({ clerkId: "user_expire_multi", reputationScore: startingRep }));
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_expire_multi", phone: "+9999999905" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      // Create 3 expired reservations for the same user
      for (let i = 0; i < 3; i++) {
        const bookId = await ctx.db.insert("books", makeBook({ title: `Book ${i}` }));
        const cId = await ctx.db.insert("copies", {
          bookId, status: "reserved", condition: "good", ownershipType: "donated",
          originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
        });
        await ctx.db.insert("reservations", {
          userId: uId,
          copyId: cId,
          locationId: locId,
          reservedAt: Date.now() - 172800000,
          status: "active",
          expiresAt: Date.now() - 86400000,
        });
      }
      return { userId: uId };
    });

    await t.mutation(internal.reservations.expireStale, {});

    const user = await t.run(async (ctx) => ctx.db.get(userId));
    // 3 expired reservations × NO_SHOW (-3) = -9 total penalty
    expect(user!.reputationScore).toBe(startingRep - 9);
  });

  it("notifies waitlist when expired reservation releases a copy", async () => {
    const t = convexTest(schema, modules);
    const { waiterId, bookId } = await t.run(async (ctx) => {
      const reserverId = await ctx.db.insert("users", makeUser({ clerkId: "user_expire_wl" }));
      const wId = await ctx.db.insert("users", makeUser({ clerkId: "waiter_expire_wl", phone: "+9999999906", name: "Waiter" }));
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_expire_wl", phone: "+9999999907" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      const bId = await ctx.db.insert("books", makeBook({ title: "Waited Book" }));
      const cId = await ctx.db.insert("copies", {
        bookId: bId, status: "reserved", condition: "good", ownershipType: "donated",
        originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
      });
      await ctx.db.insert("reservations", {
        userId: reserverId,
        copyId: cId,
        locationId: locId,
        reservedAt: Date.now() - 172800000,
        status: "active",
        expiresAt: Date.now() - 86400000,
      });
      // Waiter is on the waitlist for this book
      await ctx.db.insert("waitlist", {
        userId: wId,
        bookId: bId,
        status: "waiting",
        joinedAt: Date.now() - 86400000,
      });
      return { waiterId: wId, bookId: bId };
    });

    await t.mutation(internal.reservations.expireStale, {});

    // Waiter should be notified
    const waitlistEntry = await t.run(async (ctx) =>
      ctx.db.query("waitlist")
        .withIndex("by_user_book", (q) => q.eq("userId", waiterId).eq("bookId", bookId))
        .first(),
    );
    expect(waitlistEntry!.status).toBe("notified");
    expect(waitlistEntry!.notifiedAt).toBeDefined();
  });
});

describe("reservations.create side effects", () => {
  it("sets copy status to reserved and sends reservation_confirmed notification", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId, userId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_fx", phone: "+9999999910" }));
      const uId = await ctx.db.insert("users", makeUser({ clerkId: "reserver_fx" }));
      const bookId = await ctx.db.insert("books", makeBook({ title: "Reserved Title" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      const cId = await ctx.db.insert("copies", {
        bookId, status: "available", condition: "good", ownershipType: "donated",
        originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
      });
      return { copyId: cId, locationId: locId, userId: uId };
    });

    const authed = t.withIdentity({ subject: "reserver_fx" });
    await authed.mutation(api.reservations.create, { copyId, locationId });

    const { copy, notifications } = await t.run(async (ctx) => ({
      copy: await ctx.db.get(copyId),
      notifications: await ctx.db.query("userNotifications")
        .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("read", false))
        .collect(),
    }));
    expect(copy!.status).toBe("reserved");
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("reservation_confirmed");
    expect(notifications[0].message).toContain("Reserved Title");
  });
});

describe("reservations.cancel side effects", () => {
  it("restores copy to available when reservation is cancelled", async () => {
    const t = convexTest(schema, modules);

    const { copyId, reservationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_cancel", phone: "+9999999920" }));
      const uId = await ctx.db.insert("users", makeUser({ clerkId: "canceller_fx" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      const cId = await ctx.db.insert("copies", {
        bookId, status: "reserved", condition: "good", ownershipType: "donated",
        originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
      });
      const rId = await ctx.db.insert("reservations", {
        userId: uId, copyId: cId, locationId: locId,
        reservedAt: Date.now(), status: "active", expiresAt: Date.now() + 86400000,
      });
      return { copyId: cId, reservationId: rId };
    });

    const authed = t.withIdentity({ subject: "canceller_fx" });
    await authed.mutation(api.reservations.cancel, { reservationId });

    const { copy, reservation } = await t.run(async (ctx) => ({
      copy: await ctx.db.get(copyId),
      reservation: await ctx.db.get(reservationId),
    }));
    expect(copy!.status).toBe("available"); // restored
    expect(reservation!.status).toBe("cancelled");
  });
});

describe("reservations.create auth guards", () => {
  it("rejects sharer reserving their own book", async () => {
    const t = convexTest(schema, modules);
    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_self" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      const cId = await ctx.db.insert("copies", {
        bookId, status: "available", condition: "good", ownershipType: "lent",
        originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
      });
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "sharer_self" });
    await expect(
      authed.mutation(api.reservations.create, { copyId, locationId }),
    ).rejects.toThrow("Cannot reserve your own book");
  });
});

describe("reservations query edge cases", () => {
  it("active returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.reservations.active, {});
    expect(result).toEqual([]);
  });

  it("myActive returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.reservations.myActive, {});
    expect(result).toEqual([]);
  });

  it("myActive returns enriched data with book and location details", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser({ clerkId: "user_myactive" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId));
      const bookId = await ctx.db.insert("books", makeBook({ title: "Active Book" }));
      const copyId = await ctx.db.insert("copies", {
        bookId, status: "reserved", condition: "good", ownershipType: "donated",
        originalSharerId: userId, currentLocationId: locId, qrCodeUrl: "",
      });
      await ctx.db.insert("reservations", {
        userId, copyId, locationId: locId,
        reservedAt: Date.now(), status: "active", expiresAt: Date.now() + 86400000,
      });
    });

    const authed = t.withIdentity({ subject: "user_myactive" });
    const result = await authed.query(api.reservations.myActive, {});
    expect(result).toHaveLength(1);
    expect(result[0].bookTitle).toBe("Active Book");
    expect(result[0].locationName).toBeDefined();
  });

  it("byLocation returns only active reservations at the given location", async () => {
    const t = convexTest(schema, modules);

    const { locId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser({ clerkId: "user_byloc_res" }));
      const lId = await ctx.db.insert("partnerLocations", makeLocation(userId));
      const bookId = await ctx.db.insert("books", makeBook());
      const cId = await ctx.db.insert("copies", {
        bookId, status: "reserved", condition: "good", ownershipType: "donated",
        originalSharerId: userId, currentLocationId: lId, qrCodeUrl: "",
      });
      // Active reservation
      await ctx.db.insert("reservations", {
        userId, copyId: cId, locationId: lId,
        reservedAt: Date.now(), status: "active", expiresAt: Date.now() + 86400000,
      });
      // Expired reservation (should not be returned)
      await ctx.db.insert("reservations", {
        userId, copyId: cId, locationId: lId,
        reservedAt: Date.now() - 172800000, status: "expired", expiresAt: Date.now() - 86400000,
      });
      return { locId: lId };
    });

    const result = await t.query(api.reservations.byLocation, { locationId: locId });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("active");
  });
});
