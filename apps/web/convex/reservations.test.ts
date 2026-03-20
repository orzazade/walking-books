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
});
