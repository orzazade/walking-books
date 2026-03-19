import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_rv1",
    phone: "+1234567890",
    name: "Voter One",
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

describe("reviewVotes", () => {
  it("vote marks a review as helpful and forReview returns counts", async () => {
    const t = convexTest(schema, modules);

    const { reviewId } = await t.run(async (ctx) => {
      const reviewer = await ctx.db.insert("users", makeUser({ clerkId: "reviewer1", phone: "+1111111111", name: "Reviewer" }));
      await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const rid = await ctx.db.insert("reviews", { bookId, userId: reviewer, rating: 4, text: "Great book" });
      return { reviewId: rid };
    });

    const authed = t.withIdentity({ subject: "user_rv1" });
    await authed.mutation(api.reviewVotes.vote, { reviewId, helpful: true });

    const counts = await authed.query(api.reviewVotes.forReview, { reviewId });
    expect(counts.helpfulCount).toBe(1);
    expect(counts.unhelpfulCount).toBe(0);
    expect(counts.myVote).toBe(true);
  });

  it("vote updates existing vote (upsert)", async () => {
    const t = convexTest(schema, modules);

    const { reviewId } = await t.run(async (ctx) => {
      const reviewer = await ctx.db.insert("users", makeUser({ clerkId: "reviewer1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const rid = await ctx.db.insert("reviews", { bookId, userId: reviewer, rating: 4, text: "Good" });
      return { reviewId: rid };
    });

    const authed = t.withIdentity({ subject: "user_rv1" });
    await authed.mutation(api.reviewVotes.vote, { reviewId, helpful: true });
    await authed.mutation(api.reviewVotes.vote, { reviewId, helpful: false });

    const counts = await authed.query(api.reviewVotes.forReview, { reviewId });
    expect(counts.helpfulCount).toBe(0);
    expect(counts.unhelpfulCount).toBe(1);
    expect(counts.myVote).toBe(false);
  });

  it("prevents voting on own review", async () => {
    const t = convexTest(schema, modules);

    const { reviewId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const rid = await ctx.db.insert("reviews", { bookId, userId, rating: 5, text: "My review" });
      return { reviewId: rid };
    });

    const authed = t.withIdentity({ subject: "user_rv1" });
    await expect(
      authed.mutation(api.reviewVotes.vote, { reviewId, helpful: true }),
    ).rejects.toThrow("You cannot vote on your own review");
  });

  it("remove deletes an existing vote", async () => {
    const t = convexTest(schema, modules);

    const { reviewId } = await t.run(async (ctx) => {
      const reviewer = await ctx.db.insert("users", makeUser({ clerkId: "reviewer1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const rid = await ctx.db.insert("reviews", { bookId, userId: reviewer, rating: 4, text: "Nice" });
      return { reviewId: rid };
    });

    const authed = t.withIdentity({ subject: "user_rv1" });
    await authed.mutation(api.reviewVotes.vote, { reviewId, helpful: true });
    await authed.mutation(api.reviewVotes.remove, { reviewId });

    const counts = await authed.query(api.reviewVotes.forReview, { reviewId });
    expect(counts.helpfulCount).toBe(0);
    expect(counts.myVote).toBeNull();
  });

  it("remove throws when vote does not exist", async () => {
    const t = convexTest(schema, modules);

    const { reviewId } = await t.run(async (ctx) => {
      const reviewer = await ctx.db.insert("users", makeUser({ clerkId: "reviewer1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const rid = await ctx.db.insert("reviews", { bookId, userId: reviewer, rating: 3, text: "OK" });
      return { reviewId: rid };
    });

    const authed = t.withIdentity({ subject: "user_rv1" });
    await expect(
      authed.mutation(api.reviewVotes.remove, { reviewId }),
    ).rejects.toThrow("Vote not found");
  });

  it("forReview returns myVote null for unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    const { reviewId } = await t.run(async (ctx) => {
      const reviewer = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const rid = await ctx.db.insert("reviews", { bookId, userId: reviewer, rating: 4, text: "Good" });
      return { reviewId: rid };
    });

    const counts = await t.query(api.reviewVotes.forReview, { reviewId });
    expect(counts.helpfulCount).toBe(0);
    expect(counts.unhelpfulCount).toBe(0);
    expect(counts.myVote).toBeNull();
  });

  it("multiple users can vote on the same review", async () => {
    const t = convexTest(schema, modules);

    const { reviewId } = await t.run(async (ctx) => {
      const reviewer = await ctx.db.insert("users", makeUser({ clerkId: "reviewer1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      await ctx.db.insert("users", makeUser({ clerkId: "user_rv2", phone: "+2222222222", name: "Voter Two" }));
      await ctx.db.insert("users", makeUser({ clerkId: "user_rv3", phone: "+3333333333", name: "Voter Three" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const rid = await ctx.db.insert("reviews", { bookId, userId: reviewer, rating: 5, text: "Amazing" });
      return { reviewId: rid };
    });

    const voter1 = t.withIdentity({ subject: "user_rv1" });
    const voter2 = t.withIdentity({ subject: "user_rv2" });
    const voter3 = t.withIdentity({ subject: "user_rv3" });

    await voter1.mutation(api.reviewVotes.vote, { reviewId, helpful: true });
    await voter2.mutation(api.reviewVotes.vote, { reviewId, helpful: true });
    await voter3.mutation(api.reviewVotes.vote, { reviewId, helpful: false });

    const counts = await voter1.query(api.reviewVotes.forReview, { reviewId });
    expect(counts.helpfulCount).toBe(2);
    expect(counts.unhelpfulCount).toBe(1);
  });

  it("vote rejects unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    const { reviewId } = await t.run(async (ctx) => {
      const reviewer = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const rid = await ctx.db.insert("reviews", { bookId, userId: reviewer, rating: 4, text: "Good" });
      return { reviewId: rid };
    });

    await expect(
      t.mutation(api.reviewVotes.vote, { reviewId, helpful: true }),
    ).rejects.toThrow("Not authenticated");
  });
});
