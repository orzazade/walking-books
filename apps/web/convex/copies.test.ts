import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_copies1",
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

function makeBook(overrides: Record<string, unknown> = {}) {
  return {
    title: "Test Book",
    author: "Test Author",
    coverImage: "https://example.com/cover.jpg",
    description: "A test book",
    categories: ["fiction"],
    pageCount: 200,
    language: "English",
    avgRating: 4.0,
    reviewCount: 2,
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

function makeCopy(
  bookId: string,
  locationId: string,
  sharerId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    bookId,
    currentLocationId: locationId,
    originalSharerId: sharerId,
    status: "available" as const,
    condition: "good" as const,
    ownershipType: "lent" as const,
    lendingPeriodDays: 21,
    qrCodeUrl: "",
    ...overrides,
  };
}

describe("copies.byLocationWithBooks", () => {
  it("returns empty when no copies at location", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });

    const result = await t.query(api.copies.byLocationWithBooks, { locationId: locId });
    expect(result).toEqual([]);
  });

  it("returns copies enriched with book metadata", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook({ title: "My Book", author: "Jane Doe" }));
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId));
    });

    const result = await t.query(api.copies.byLocationWithBooks, { locationId: locId });
    expect(result).toHaveLength(1);
    expect(result[0].book.title).toBe("My Book");
    expect(result[0].book.author).toBe("Jane Doe");
    expect(result[0].book._id).toBe(bookId);
    expect(result[0].book.coverImage).toBe("https://example.com/cover.jpg");
    expect(result[0].book.avgRating).toBe(4.0);
    expect(result[0].book.categories).toEqual(["fiction"]);
  });

  it("excludes non-available copies", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId, { status: "checked_out" }));
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId, { status: "available" }));
    });

    const result = await t.query(api.copies.byLocationWithBooks, { locationId: locId });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("available");
  });

  it("returns multiple copies with different books", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });
    const book1 = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook({ title: "Book A", author: "Author A" }));
    });
    const book2 = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook({ title: "Book B", author: "Author B" }));
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(book1, locId, userId));
      await ctx.db.insert("copies", makeCopy(book2, locId, userId));
    });

    const result = await t.query(api.copies.byLocationWithBooks, { locationId: locId });
    expect(result).toHaveLength(2);
    const titles = result.map((r: { book: { title: string } }) => r.book.title).sort();
    expect(titles).toEqual(["Book A", "Book B"]);
  });

  it("does not return copies from other locations", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const loc1 = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId, { name: "Location 1" }));
    });
    const loc2 = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId, { name: "Location 2" }));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, loc1, userId));
      await ctx.db.insert("copies", makeCopy(bookId, loc2, userId));
    });

    const result1 = await t.query(api.copies.byLocationWithBooks, { locationId: loc1 });
    expect(result1).toHaveLength(1);

    const result2 = await t.query(api.copies.byLocationWithBooks, { locationId: loc2 });
    expect(result2).toHaveLength(1);
  });

  it("deduplicates book fetches for multiple copies of same book", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook({ title: "Same Book" }));
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId));
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId));
    });

    const result = await t.query(api.copies.byLocationWithBooks, { locationId: locId });
    expect(result).toHaveLength(2);
    expect(result[0].book.title).toBe("Same Book");
    expect(result[1].book.title).toBe("Same Book");
    expect(result[0].book._id).toBe(result[1].book._id);
  });
});
