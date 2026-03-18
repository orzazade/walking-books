import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("wishlist", () => {
  it("toggle adds a book to the wishlist for an authenticated user", async () => {
    const t = convexTest(schema, modules);

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
    const t = convexTest(schema, modules);

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

  it("availableNow returns wishlisted books that have available copies", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "user_avail1",
        phone: "+1234567892",
        name: "Avail User",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
    });

    const { bookWithCopy, bookWithoutCopy, locationId } = await t.run(
      async (ctx) => {
        const locId = await ctx.db.insert("partnerLocations", {
          name: "Test Library",
          address: "123 Main St",
          lat: 0,
          lng: 0,
          contactPhone: "+1000000000",
          operatingHours: {},
          photos: [],
          shelfCapacity: 100,
          currentBookCount: 5,
          managedByUserId: userId,
          staffUserIds: [],
        });

        const b1 = await ctx.db.insert("books", {
          title: "Available Book",
          author: "Author A",
          coverImage: "https://example.com/a.jpg",
          description: "Has copies",
          categories: ["fiction"],
          pageCount: 200,
          language: "English",
          avgRating: 4.0,
          reviewCount: 5,
        });

        await ctx.db.insert("copies", {
          bookId: b1,
          status: "available",
          condition: "good",
          ownershipType: "donated",
          originalSharerId: userId,
          currentLocationId: locId,
          qrCodeUrl: "",
        });

        const b2 = await ctx.db.insert("books", {
          title: "Unavailable Book",
          author: "Author B",
          coverImage: "",
          description: "No copies",
          categories: ["fiction"],
          pageCount: 100,
          language: "English",
          avgRating: 3.0,
          reviewCount: 1,
        });

        return { bookWithCopy: b1, bookWithoutCopy: b2, locationId: locId };
      },
    );

    const authed = t.withIdentity({ subject: "user_avail1" });

    // Wishlist both books
    await authed.mutation(api.wishlist.toggle, { bookId: bookWithCopy });
    await authed.mutation(api.wishlist.toggle, { bookId: bookWithoutCopy });

    const available = await authed.query(api.wishlist.availableNow, {});

    // Should only return the book with an available copy
    expect(available).toHaveLength(1);
    expect(available[0].title).toBe("Available Book");
    expect(available[0].availableCount).toBe(1);
    expect(available[0].locations).toHaveLength(1);
    expect(available[0].locations[0].name).toBe("Test Library");
  });

  it("availableNow returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.wishlist.availableNow, {});
    expect(result).toEqual([]);
  });

  it("isWishlisted returns false for unauthenticated users", async () => {
    const t = convexTest(schema, modules);

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
    const t = convexTest(schema, modules);

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
