import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const byBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reviews")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
  },
});

export const create = mutation({
  args: {
    bookId: v.id("books"),
    rating: v.number(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    // Upsert: one review per user per book
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_user_book", (q) =>
        q.eq("userId", user._id).eq("bookId", args.bookId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        text: args.text,
      });

      // Recalculate book average with updated rating
      const book = await ctx.db.get(args.bookId);
      if (book && book.reviewCount > 0) {
        const newAvg =
          (book.avgRating * book.reviewCount - existing.rating + args.rating) /
          book.reviewCount;
        await ctx.db.patch(args.bookId, {
          avgRating: Math.round(newAvg * 10) / 10,
        });
      }

      return existing._id;
    }

    const reviewId = await ctx.db.insert("reviews", {
      bookId: args.bookId,
      userId: user._id,
      rating: args.rating,
      text: args.text,
    });

    // Update book aggregate rating
    const book = await ctx.db.get(args.bookId);
    if (book) {
      const newCount = book.reviewCount + 1;
      const newAvg =
        (book.avgRating * book.reviewCount + args.rating) / newCount;
      await ctx.db.patch(args.bookId, {
        avgRating: Math.round(newAvg * 10) / 10,
        reviewCount: newCount,
      });
    }

    return reviewId;
  },
});
