import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_r1",
    phone: "+1234567890",
    name: "Reviewer",
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

describe("reviews", () => {
  it("byUser returns reviews enriched with book info", async () => {
    const t = convexTest(schema, modules);

    const { userId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const book1 = await ctx.db.insert("books", makeBook({ title: "Book One", author: "Author A" }));
      const book2 = await ctx.db.insert("books", makeBook({ title: "Book Two", author: "Author B" }));
      await ctx.db.insert("reviews", { bookId: book1, userId: uid, rating: 5, text: "Loved it" });
      await ctx.db.insert("reviews", { bookId: book2, userId: uid, rating: 3, text: "It was okay" });
      return { userId: uid };
    });

    const reviews = await t.query(api.reviews.byUser, { userId });
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({
      bookTitle: "Book One",
      bookAuthor: "Author A",
      rating: 5,
      text: "Loved it",
    });
    expect(reviews[1]).toMatchObject({
      bookTitle: "Book Two",
      bookAuthor: "Author B",
      rating: 3,
      text: "It was okay",
    });
  });

  it("byUser returns empty array for user with no reviews", async () => {
    const t = convexTest(schema, modules);

    const { userId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      return { userId: uid };
    });

    const reviews = await t.query(api.reviews.byUser, { userId });
    expect(reviews).toHaveLength(0);
  });

  it("byUser excludes reviews for deleted books", async () => {
    const t = convexTest(schema, modules);

    const { userId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const book1 = await ctx.db.insert("books", makeBook({ title: "Kept Book" }));
      const book2 = await ctx.db.insert("books", makeBook({ title: "Deleted Book" }));
      await ctx.db.insert("reviews", { bookId: book1, userId: uid, rating: 4, text: "Good" });
      await ctx.db.insert("reviews", { bookId: book2, userId: uid, rating: 2, text: "Meh" });
      await ctx.db.delete(book2);
      return { userId: uid };
    });

    const reviews = await t.query(api.reviews.byUser, { userId });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ bookTitle: "Kept Book" });
  });

  it("create validates rating range", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_r1" });
    const books = await t.run(async (ctx) => ctx.db.query("books").collect());

    await expect(
      authed.mutation(api.reviews.create, { bookId: books[0]._id, rating: 0, text: "Bad" }),
    ).rejects.toThrow("Rating must be an integer between 1 and 5");

    await expect(
      authed.mutation(api.reviews.create, { bookId: books[0]._id, rating: 6, text: "Too high" }),
    ).rejects.toThrow("Rating must be an integer between 1 and 5");
  });

  it("friendsRecommendations returns high-rated books from followed users excluding already-read", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      // Create current user and a friend
      const me = await ctx.db.insert("users", makeUser({ clerkId: "user_me", name: "Me" }));
      const friend = await ctx.db.insert("users", makeUser({ clerkId: "user_friend", name: "Friend" }));

      // Follow the friend
      await ctx.db.insert("follows", { followerId: me, followingId: friend });

      // Create books
      const bookA = await ctx.db.insert("books", makeBook({ title: "Great Book", author: "Author A" }));
      const bookB = await ctx.db.insert("books", makeBook({ title: "Okay Book", author: "Author B" }));
      const bookC = await ctx.db.insert("books", makeBook({ title: "Already Read", author: "Author C" }));

      // Friend reviews: bookA (5 stars), bookB (2 stars — below threshold), bookC (4 stars)
      await ctx.db.insert("reviews", { bookId: bookA, userId: friend, rating: 5, text: "Amazing" });
      await ctx.db.insert("reviews", { bookId: bookB, userId: friend, rating: 2, text: "Meh" });
      await ctx.db.insert("reviews", { bookId: bookC, userId: friend, rating: 4, text: "Good" });

      // I already finished bookC
      const copyC = await ctx.db.insert("copies", {
        bookId: bookC,
        status: "available" as any,
        condition: "good" as any,
        ownershipType: "lent" as any,
        originalSharerId: friend,
        qrCodeUrl: "",
      });
      await ctx.db.insert("readingProgress", {
        userId: me,
        copyId: copyC,
        bookId: bookC,
        currentPage: 200,
        totalPages: 200,
        status: "finished" as any,
        startedAt: Date.now() - 86400000,
        lastUpdatedAt: Date.now(),
        finishedAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: "user_me" });
    const recs = await authed.query(api.reviews.friendsRecommendations, {});

    // Should only include bookA (5 stars, not read). bookB excluded (2 stars). bookC excluded (already read).
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({
      bookTitle: "Great Book",
      bookAuthor: "Author A",
      rating: 5,
      reviewerName: "Friend",
    });
  });

  it("create rejects empty review text", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_r1" });
    const books = await t.run(async (ctx) => ctx.db.query("books").collect());

    await expect(
      authed.mutation(api.reviews.create, { bookId: books[0]._id, rating: 4, text: "   " }),
    ).rejects.toThrow("Review text is required");
  });
});
