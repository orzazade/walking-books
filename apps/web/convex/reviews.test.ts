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

  it("create adds review and updates book avgRating and reviewCount", async () => {
    const t = convexTest(schema, modules);

    const { bookId } = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      const bId = await ctx.db.insert("books", makeBook());
      return { bookId: bId };
    });

    const authed = t.withIdentity({ subject: "user_r1" });
    await authed.mutation(api.reviews.create, { bookId, rating: 4, text: "Really enjoyed it" });

    // Verify the book's avgRating and reviewCount were updated
    const book = await t.run(async (ctx) => ctx.db.get(bookId));
    expect(book!.avgRating).toBe(4);
    expect(book!.reviewCount).toBe(1);

    // Verify the review exists via byBook
    const reviews = await t.query(api.reviews.byBook, { bookId });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].rating).toBe(4);
    expect(reviews[0].text).toBe("Really enjoyed it");
  });

  it("create upserts existing review and recalculates book avgRating", async () => {
    const t = convexTest(schema, modules);

    const { bookId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      // Book starts with one existing review from another user
      const bId = await ctx.db.insert("books", makeBook({ avgRating: 3, reviewCount: 1 }));
      await ctx.db.insert("users", makeUser({ clerkId: "user_other", phone: "+9999999999", name: "Other" }));
      return { bookId: bId };
    });

    const authed = t.withIdentity({ subject: "user_r1" });

    // First review: rating 5
    await authed.mutation(api.reviews.create, { bookId, rating: 5, text: "Amazing" });
    const bookAfterFirst = await t.run(async (ctx) => ctx.db.get(bookId));
    expect(bookAfterFirst!.reviewCount).toBe(2);

    // Update same review: rating 2
    await authed.mutation(api.reviews.create, { bookId, rating: 2, text: "Changed my mind" });

    // reviewCount should stay at 2 (upsert, not new review)
    const bookAfterUpdate = await t.run(async (ctx) => ctx.db.get(bookId));
    expect(bookAfterUpdate!.reviewCount).toBe(2);

    // Verify the review text was updated
    const reviews = await t.query(api.reviews.byBook, { bookId });
    const myReview = reviews.find((r: { text: string }) => r.text === "Changed my mind");
    expect(myReview).toBeDefined();
    expect(myReview!.rating).toBe(2);
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

  it("create rejects nonexistent book", async () => {
    const t = convexTest(schema, modules);

    const fakeBookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      const bId = await ctx.db.insert("books", makeBook());
      await ctx.db.delete(bId);
      return bId;
    });

    const authed = t.withIdentity({ subject: "user_r1" });

    await expect(
      authed.mutation(api.reviews.create, {
        bookId: fakeBookId,
        rating: 4,
        text: "Great book!",
      }),
    ).rejects.toThrow("Book not found");
  });

  it("byBook returns all reviews for a given book", async () => {
    const t = convexTest(schema, modules);

    const { bookId } = await t.run(async (ctx) => {
      const u1 = await ctx.db.insert("users", makeUser());
      const u2 = await ctx.db.insert("users", makeUser({ clerkId: "user_r2", phone: "+2222222222", name: "Reviewer 2" }));
      const bId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("reviews", { userId: u1, bookId: bId, rating: 5, text: "Loved it!" });
      await ctx.db.insert("reviews", { userId: u2, bookId: bId, rating: 3, text: "It was okay" });
      return { bookId: bId };
    });

    const reviews = await t.query(api.reviews.byBook, { bookId });
    expect(reviews).toHaveLength(2);
    const ratings = reviews.map((r: { rating: number }) => r.rating).sort();
    expect(ratings).toEqual([3, 5]);
  });

  it("byBook returns empty array for book with no reviews", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => ctx.db.insert("books", makeBook()));

    const reviews = await t.query(api.reviews.byBook, { bookId });
    expect(reviews).toHaveLength(0);
  });

  it("create rejects unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => ctx.db.insert("books", makeBook()));

    await expect(
      t.mutation(api.reviews.create, { bookId, rating: 4, text: "Nice" }),
    ).rejects.toThrow("Not authenticated");
  });

  it("create rejects review text over 5000 characters", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_r1" });

    await expect(
      authed.mutation(api.reviews.create, {
        bookId,
        rating: 4,
        text: "A".repeat(5001),
      }),
    ).rejects.toThrow("Review text must be 5000 characters or less");
  });
});
