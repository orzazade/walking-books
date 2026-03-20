import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";
import { recalcAvgRating } from "./lib/ratings";
import type { Id } from "./_generated/dataModel";

export const byBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reviews")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
  },
});

export const byUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const bookIds = [...new Set(reviews.map((r) => r.bookId))];
    const books = await Promise.all(bookIds.map((id) => ctx.db.get(id)));
    const bookMap = new Map(
      books.filter(Boolean).map((b) => [b!._id, b!]),
    );

    return reviews
      .map((r) => {
        const book = bookMap.get(r.bookId);
        if (!book) return null;
        return {
          _id: r._id,
          _creationTime: r._creationTime,
          bookId: r.bookId,
          rating: r.rating,
          text: r.text,
          bookTitle: book.title,
          bookAuthor: book.author,
          bookCoverImage: book.coverImage,
        };
      })
      .filter(Boolean);
  },
});

export const create = mutation({
  args: {
    bookId: v.id("books"),
    rating: v.number(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    if (args.rating < 1 || args.rating > 5 || !Number.isInteger(args.rating))
      throw new Error("Rating must be an integer between 1 and 5");
    const trimmedText = args.text.trim();
    if (trimmedText.length === 0)
      throw new Error("Review text is required");
    if (trimmedText.length > 5000)
      throw new Error("Review text must be 5000 characters or less");

    // Upsert: one review per user per book
    const [book, existing] = await Promise.all([
      ctx.db.get(args.bookId),
      ctx.db
        .query("reviews")
        .withIndex("by_user_book", (q) =>
          q.eq("userId", user._id).eq("bookId", args.bookId),
        )
        .unique(),
    ]);
    if (!book) throw new Error("Book not found");

    if (existing) {
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        text: trimmedText,
      });

      // Recalculate book average with updated rating
      const updated = recalcAvgRating(
        book.avgRating, book.reviewCount, args.rating, existing.rating,
      );
      await ctx.db.patch(args.bookId, { avgRating: updated.avgRating });

      return existing._id;
    }

    const reviewId = await ctx.db.insert("reviews", {
      bookId: args.bookId,
      userId: user._id,
      rating: args.rating,
      text: trimmedText,
    });

    // Update book aggregate rating
    const { avgRating, reviewCount } = recalcAvgRating(
      book.avgRating, book.reviewCount, args.rating,
    );
    await ctx.db.patch(args.bookId, { avgRating, reviewCount });

    return reviewId;
  },
});

export const friendsRecommendations = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // Get followed user IDs
    const followRows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", user._id))
      .collect();
    if (followRows.length === 0) return [];
    const followedIds = followRows.map((f) => f.followingId);

    // Get reviews by followed users (batch)
    const reviewsPerUser = await Promise.all(
      followedIds.map((uid) =>
        ctx.db
          .query("reviews")
          .withIndex("by_user", (q) => q.eq("userId", uid))
          .collect(),
      ),
    );

    // Flatten and keep only highly-rated reviews (4-5 stars)
    type Candidate = { userId: Id<"users">; bookId: Id<"books">; rating: number };
    const highRated: Candidate[] = [];
    for (let i = 0; i < followedIds.length; i++) {
      for (const review of reviewsPerUser[i]) {
        if (review.rating >= 4) {
          highRated.push({
            userId: followedIds[i],
            bookId: review.bookId,
            rating: review.rating,
          });
        }
      }
    }
    if (highRated.length === 0) return [];

    // Exclude books the current user has already read (finished)
    const [finishedProgress, myReviews] = await Promise.all([
      ctx.db
        .query("readingProgress")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", "finished"),
        )
        .collect(),
      ctx.db
        .query("reviews")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
    ]);
    const excludedBookIds = new Set<string>([
      ...finishedProgress.map((p) => p.bookId as string),
      ...myReviews.map((r) => r.bookId as string),
    ]);

    // Filter and deduplicate by bookId (keep highest rating + first reviewer)
    const bestByBook = new Map<string, Candidate>();
    for (const entry of highRated) {
      if (excludedBookIds.has(entry.bookId as string)) continue;
      const existing = bestByBook.get(entry.bookId as string);
      if (!existing || entry.rating > existing.rating) {
        bestByBook.set(entry.bookId as string, entry);
      }
    }

    // Sort by rating desc, limit to 8
    const candidates = [...bestByBook.values()]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8);
    if (candidates.length === 0) return [];

    // Batch-fetch books and reviewers
    const uniqueBookIds = [...new Set(candidates.map((c) => c.bookId))];
    const uniqueUserIds = [...new Set(candidates.map((c) => c.userId))];

    const [books, users] = await Promise.all([
      Promise.all(uniqueBookIds.map((id) => ctx.db.get(id))),
      Promise.all(uniqueUserIds.map((id) => ctx.db.get(id))),
    ]);

    const bookMap = new Map(uniqueBookIds.map((id, i) => [id, books[i]]));
    const userMap = new Map(uniqueUserIds.map((id, i) => [id, users[i]]));

    return candidates
      .map((c) => {
        const book = bookMap.get(c.bookId);
        const reviewer = userMap.get(c.userId);
        if (!book || !reviewer) return null;
        return {
          bookId: book._id,
          bookTitle: book.title,
          bookAuthor: book.author,
          coverImage: book.coverImage,
          rating: c.rating,
          reviewerId: reviewer._id,
          reviewerName: reviewer.name,
          reviewerAvatarUrl: reviewer.avatarUrl,
        };
      })
      .filter((r) => r !== null);
  },
});
