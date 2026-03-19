import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser } from "./lib/auth";
import { DAY_MS } from "./lib/lending";

export const getStats = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // If userId provided, show public stats for that user
    // Otherwise, show stats for the current user
    let targetUserId = args.userId;
    if (!targetUserId) {
      const user = await getCurrentUser(ctx);
      if (!user) return null;
      targetUserId = user._id;
    }

    // Get all copies shared by this user
    const copies = await ctx.db
      .query("copies")
      .withIndex("by_sharer", (q) => q.eq("originalSharerId", targetUserId))
      .collect();

    if (copies.length === 0) {
      return {
        totalCopiesShared: 0,
        totalTimesLent: 0,
        currentlyLent: 0,
        uniqueReaders: 0,
        avgLendingDays: null,
        mostPopularBook: null,
        topLocations: [],
      };
    }

    // Batch-fetch journey entries for all copies
    const journeyArrays = await Promise.all(
      copies.map((copy) =>
        ctx.db
          .query("journeyEntries")
          .withIndex("by_copy", (q) => q.eq("copyId", copy._id))
          .collect(),
      ),
    );
    const allJourneys = journeyArrays.flat();

    const completedLends = allJourneys.filter((j) => j.returnedAt !== undefined);
    const currentlyLent = copies.filter((c) => c.status === "checked_out").length;

    // Unique readers
    const uniqueReaderIds = new Set(allJourneys.map((j) => j.readerId));

    // Average lending duration (completed lends only)
    let avgLendingDays: number | null = null;
    if (completedLends.length > 0) {
      const totalDays = completedLends.reduce((sum, j) => {
        return sum + (j.returnedAt! - j.pickedUpAt) / DAY_MS;
      }, 0);
      avgLendingDays = Math.round((totalDays / completedLends.length) * 10) / 10;
    }

    // Most popular book (most journey entries)
    const lendCountByBook = new Map<Id<"books">, number>();
    for (let i = 0; i < copies.length; i++) {
      const bookId = copies[i].bookId;
      const copyJourneys = journeyArrays[i];
      lendCountByBook.set(
        bookId,
        (lendCountByBook.get(bookId) ?? 0) + copyJourneys.length,
      );
    }

    let mostPopularBook: { title: string; author: string; timesLent: number } | null = null;
    if (lendCountByBook.size > 0) {
      const [topBookId, topCount] = [...lendCountByBook.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
      if (topBookId && topCount > 0) {
        const book = await ctx.db.get(topBookId);
        if (book) {
          mostPopularBook = {
            title: book.title,
            author: book.author,
            timesLent: topCount,
          };
        }
      }
    }

    // Top locations where shared books currently sit
    const locationCounts = new Map<Id<"partnerLocations">, number>();
    for (const copy of copies) {
      if (copy.currentLocationId) {
        locationCounts.set(copy.currentLocationId, (locationCounts.get(copy.currentLocationId) ?? 0) + 1);
      }
    }

    const topLocationEntries = [...locationCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const locationDocs = await Promise.all(
      topLocationEntries.map(([locId]) => ctx.db.get(locId)),
    );

    const topLocations = topLocationEntries
      .map(([, count], i) => {
        const loc = locationDocs[i];
        if (!loc) return null;
        return { name: loc.name, count };
      })
      .filter((l) => l !== null);

    return {
      totalCopiesShared: copies.length,
      totalTimesLent: allJourneys.length,
      currentlyLent,
      uniqueReaders: uniqueReaderIds.size,
      avgLendingDays,
      mostPopularBook,
      topLocations,
    };
  },
});
