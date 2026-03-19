import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

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

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_new1",
    phone: "+1234567890",
    name: "New Arrivals User",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
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

describe("newArrivals", () => {
  it("returns empty when no books exist", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.newArrivals.recent, {});
    expect(result).toEqual([]);
  });

  it("returns books ordered by newest first", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("books", makeBook({ title: "First Book" }));
      await ctx.db.insert("books", makeBook({ title: "Second Book" }));
      await ctx.db.insert("books", makeBook({ title: "Third Book" }));
    });

    const result = await t.query(api.newArrivals.recent, {});
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("Third Book");
    expect(result[1].title).toBe("Second Book");
    expect(result[2].title).toBe("First Book");
  });

  it("includes availability info from copies", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(userId as string));
      const bookId = await ctx.db.insert("books", makeBook({ title: "Available Book" }));

      // 2 copies: one available, one checked out
      await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
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
    });

    const result = await t.query(api.newArrivals.recent, {});
    expect(result).toHaveLength(1);
    expect(result[0].availableCopies).toBe(1);
    expect(result[0].totalCopies).toBe(2);
  });

  it("respects limit parameter", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("books", makeBook({ title: `Book ${i}` }));
      }
    });

    const result = await t.query(api.newArrivals.recent, { limit: 3 });
    expect(result).toHaveLength(3);
  });

  it("clamps limit to valid range", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("books", makeBook({ title: `Book ${i}` }));
      }
    });

    // Negative limit clamped to 1
    const result = await t.query(api.newArrivals.recent, { limit: -5 });
    expect(result).toHaveLength(1);
  });

  it("works without authentication (public query)", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("books", makeBook({ title: "Public Book" }));
    });

    // No withIdentity — should work for anonymous users
    const result = await t.query(api.newArrivals.recent, {});
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Public Book");
  });

  it("returns book metadata and addedAt timestamp", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("books", makeBook({
        title: "Detailed Book",
        author: "Jane Author",
        coverImage: "https://example.com/cover.jpg",
        categories: ["mystery", "thriller"],
        avgRating: 4.2,
        reviewCount: 15,
      }));
    });

    const result = await t.query(api.newArrivals.recent, {});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Detailed Book",
      author: "Jane Author",
      coverImage: "https://example.com/cover.jpg",
      categories: ["mystery", "thriller"],
      avgRating: 4.2,
      reviewCount: 15,
      availableCopies: 0,
      totalCopies: 0,
    });
    expect(result[0].addedAt).toBeTypeOf("number");
  });

  it("defaults to 20 results", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (let i = 0; i < 25; i++) {
        await ctx.db.insert("books", makeBook({ title: `Book ${i}` }));
      }
    });

    const result = await t.query(api.newArrivals.recent, {});
    expect(result).toHaveLength(20);
  });
});
