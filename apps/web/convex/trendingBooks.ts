import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getBookCopyCounts } from "./lib/availability";
import { DAY_MS } from "./lib/lending";

/**
 * Trending books — ranks books by recent community pickup activity.
 * Returns the top 10 most-picked-up books in the last 30 days,
 * with availability info and pickup counts.
 */
export const trending = query({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * DAY_MS;

    // Get recent journey entries using index (pickups in last 30 days)
    const recentPickups = await ctx.db
      .query("journeyEntries")
      .withIndex("by_pickedUpAt", (q) => q.gte("pickedUpAt", thirtyDaysAgo))
      .collect();

    // Map copy IDs to book IDs, counting pickups per book
    const copyIds = new Set<Id<"copies">>();
    for (const entry of recentPickups) {
      copyIds.add(entry.copyId);
    }

    const copyDocs = await Promise.all(
      [...copyIds].map((id) => ctx.db.get(id)),
    );
    const copyToBook = new Map<Id<"copies">, Id<"books">>();
    for (const doc of copyDocs) {
      if (doc) copyToBook.set(doc._id, doc.bookId);
    }

    const bookPickups = new Map<Id<"books">, number>();
    for (const entry of recentPickups) {
      const bookId = copyToBook.get(entry.copyId);
      if (bookId) {
        bookPickups.set(bookId, (bookPickups.get(bookId) ?? 0) + 1);
      }
    }

    if (bookPickups.size === 0) return [];

    // Sort by pickup count descending, take top 10
    const sorted = [...bookPickups.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Fetch book details and availability
    const copyCounts = await getBookCopyCounts(ctx);
    const results = await Promise.all(
      sorted.map(async ([bookId, pickups]) => {
        const book = await ctx.db.get(bookId);
        if (!book) return null;
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
          recentPickups: pickups,
          availableCopies: availability.availableCopies,
          totalCopies: availability.totalCopies,
        };
      }),
    );

    return results.filter((r) => r !== null);
  },
});
