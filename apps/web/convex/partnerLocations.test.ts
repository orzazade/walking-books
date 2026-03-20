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
