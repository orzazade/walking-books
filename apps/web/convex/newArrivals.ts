import { v } from "convex/values";
import { query } from "./_generated/server";
import { getBookCopyCountsFor } from "./lib/availability";

/**
 * New Arrivals — returns the most recently registered books on the platform.
 * Public query (no auth required) so any visitor can discover new additions.
 */
export const recent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    const books = await ctx.db
      .query("books")
      .order("desc")
      .take(limit);

    if (books.length === 0) return [];

    const bookIds = books.map((b) => b._id);
    const copyCounts = await getBookCopyCountsFor(ctx, bookIds);

    return books.map((book) => {
      const availability = copyCounts.get(book._id) ?? {
        totalCopies: 0,
        availableCopies: 0,
      };
      return {
        _id: book._id,
        title: book.title,
        author: book.author,
        coverImage: book.coverImage,
        categories: book.categories,
        avgRating: book.avgRating,
        reviewCount: book.reviewCount,
        availableCopies: availability.availableCopies,
        totalCopies: availability.totalCopies,
        addedAt: book._creationTime,
      };
    });
  },
});
