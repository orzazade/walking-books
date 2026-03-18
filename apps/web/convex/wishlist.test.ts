import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

describe("wishlist", () => {
  it("toggle adds a book to the wishlist for an authenticated user", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "user_test123",
        phone: "+1234567890",
        name: "Test User",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
    });

    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", {
        title: "Test Book",
        author: "Test Author",
        coverImage: "https://example.com/cover.jpg",
        description: "A test book",
        categories: ["fiction"],
        pageCount: 200,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });
    });

    const authed = t.withIdentity({ subject: "user_test123" });

    // Initially not wishlisted
    const before = await authed.query(api.wishlist.isWishlisted, { bookId });
    expect(before).toBe(false);

    // Toggle on
    const result = await authed.mutation(api.wishlist.toggle, { bookId });
    expect(result.wishlisted).toBe(true);

    // Verify wishlisted
    const after = await authed.query(api.wishlist.isWishlisted, { bookId });
    expect(after).toBe(true);

    // Toggle off
    const result2 = await authed.mutation(api.wishlist.toggle, { bookId });
    expect(result2.wishlisted).toBe(false);

    // Verify removed
    const final = await authed.query(api.wishlist.isWishlisted, { bookId });
    expect(final).toBe(false);
  });

  it("myWishlist returns books with availability info", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "user_test456",
        phone: "+1234567891",
        name: "Test User 2",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
    });

    const bookId = await t.run(async (ctx) => {
      const bid = await ctx.db.insert("books", {
        title: "Wishlist Book",
        author: "Author Name",
        coverImage: "https://example.com/cover2.jpg",
        description: "Another test book",
        categories: ["non-fiction"],
        pageCount: 150,
        language: "English",
        avgRating: 4.5,
        reviewCount: 10,
      });
      // Add an available copy
      await ctx.db.insert("copies", {
        bookId: bid,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "https://example.com/qr",
      });
      return bid;
    });

    const authed = t.withIdentity({ subject: "user_test456" });

    // Add to wishlist
    await authed.mutation(api.wishlist.toggle, { bookId });

    // Check myWishlist
    const wishlist = await authed.query(api.wishlist.myWishlist, {});
    expect(wishlist).toHaveLength(1);
    expect(wishlist[0].book.title).toBe("Wishlist Book");
    expect(wishlist[0].availableCount).toBe(1);
  });

  it("isWishlisted returns false for unauthenticated users", async () => {
    const t = convexTest(schema);

    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", {
        title: "Any Book",
        author: "Any Author",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 100,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });
    });

    const result = await t.query(api.wishlist.isWishlisted, { bookId });
    expect(result).toBe(false);
  });

  it("toggle throws for unauthenticated users", async () => {
    const t = convexTest(schema);

    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", {
        title: "Any Book",
        author: "Any Author",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 100,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });
    });

    await expect(
      t.mutation(api.wishlist.toggle, { bookId }),
    ).rejects.toThrow("Not authenticated");
  });
});
