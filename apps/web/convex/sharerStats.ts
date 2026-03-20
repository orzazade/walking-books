import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser } from "./lib/auth";
import { DAY_MS } from "./lib/lending";

/** Label for a month bucket, e.g. "Jan 2026". */
function monthLabel(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

/** Key for sorting month buckets: "2026-01". */
function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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

    const completedLends = allJourneys.filter(
      (j): j is typeof j & { returnedAt: number } => j.returnedAt !== undefined,
    );
    const currentlyLent = copies.filter((c) => c.status === "checked_out").length;

    // Unique readers
    const uniqueReaderIds = new Set(allJourneys.map((j) => j.readerId));

    // Average lending duration (completed lends only)
    let avgLendingDays: number | null = null;
    if (completedLends.length > 0) {
      const totalDays = completedLends.reduce((sum, j) => {
        return sum + (j.returnedAt - j.pickedUpAt) / DAY_MS;
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

    // Determine top book and top locations (synchronous from in-memory data)
    let topBookId: Id<"books"> | null = null;
    let topCount = 0;
    if (lendCountByBook.size > 0) {
      const top = [...lendCountByBook.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])[0];
      if (top) {
        [topBookId, topCount] = top;
      }
    }

    const locationCounts = new Map<Id<"partnerLocations">, number>();
    for (const copy of copies) {
      if (copy.currentLocationId) {
        locationCounts.set(copy.currentLocationId, (locationCounts.get(copy.currentLocationId) ?? 0) + 1);
      }
    }
    const topLocationEntries = [...locationCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Fetch top book and location docs concurrently
    const [topBook, locationDocs] = await Promise.all([
      topBookId ? ctx.db.get(topBookId) : null,
      Promise.all(topLocationEntries.map(([locId]) => ctx.db.get(locId))),
    ]);

    const mostPopularBook = topBook && topCount > 0
      ? { title: topBook.title, author: topBook.author, timesLent: topCount }
      : null;

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

/**
 * Per-book breakdown + monthly lending trends for the sharer analytics page.
 * Gives sharers with many books a detailed view of each book's performance
 * and their lending activity over the last 6 months.
 */
export const perBookBreakdown = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const copies = await ctx.db
      .query("copies")
      .withIndex("by_sharer", (q) => q.eq("originalSharerId", user._id))
      .collect();

    if (copies.length === 0) return { books: [], monthlyActivity: [] };

    // Batch-fetch journey entries + book docs concurrently
    const bookIds = [...new Set(copies.map((c) => c.bookId))];
    const [journeyArrays, bookDocs] = await Promise.all([
      Promise.all(
        copies.map((copy) =>
          ctx.db
            .query("journeyEntries")
            .withIndex("by_copy", (q) => q.eq("copyId", copy._id))
            .collect(),
        ),
      ),
      Promise.all(bookIds.map((id) => ctx.db.get(id))),
    ]);

    // Build book lookup
    const bookById = new Map<string, { title: string; author: string; coverImage: string }>();
    for (const book of bookDocs) {
      if (book) bookById.set(book._id, { title: book.title, author: book.author, coverImage: book.coverImage });
    }

    // Aggregate per-book: group copies by bookId
    const bookAgg = new Map<
      string,
      {
        title: string;
        author: string;
        coverImage: string;
        copiesCount: number;
        timesLent: number;
        uniqueReaders: Set<string>;
        activeLends: number;
        totalReadingDays: number;
        completedLends: number;
        bestCondition: string;
        worstCondition: string;
      }
    >();

    const conditionRank: Record<string, number> = {
      like_new: 4,
      good: 3,
      fair: 2,
      worn: 1,
    };

    // Monthly activity buckets (last 6 months)
    const now = Date.now();
    const sixMonthsAgo = now - 180 * DAY_MS;
    const monthBuckets = new Map<string, { key: string; label: string; pickups: number; returns: number }>();

    for (let i = 0; i < copies.length; i++) {
      const copy = copies[i];
      const journeys = journeyArrays[i];
      const book = bookById.get(copy.bookId);
      if (!book) continue;

      const bookKey = copy.bookId;
      let agg = bookAgg.get(bookKey);
      if (!agg) {
        agg = {
          ...book,
          copiesCount: 0,
          timesLent: 0,
          uniqueReaders: new Set(),
          activeLends: 0,
          totalReadingDays: 0,
          completedLends: 0,
          bestCondition: copy.condition,
          worstCondition: copy.condition,
        };
        bookAgg.set(bookKey, agg);
      }

      agg.copiesCount++;
      if (copy.status === "checked_out") agg.activeLends++;

      // Track worst/best condition across copies
      const copyRank = conditionRank[copy.condition] ?? 0;
      if (copyRank < (conditionRank[agg.worstCondition] ?? 0)) agg.worstCondition = copy.condition;
      if (copyRank > (conditionRank[agg.bestCondition] ?? 0)) agg.bestCondition = copy.condition;

      for (const j of journeys) {
        agg.timesLent++;
        agg.uniqueReaders.add(j.readerId);

        if (j.returnedAt !== undefined) {
          agg.completedLends++;
          agg.totalReadingDays += (j.returnedAt - j.pickedUpAt) / DAY_MS;
        }

        // Monthly buckets
        if (j.pickedUpAt >= sixMonthsAgo) {
          const key = monthKey(j.pickedUpAt);
          if (!monthBuckets.has(key)) {
            monthBuckets.set(key, { key, label: monthLabel(j.pickedUpAt), pickups: 0, returns: 0 });
          }
          monthBuckets.get(key)!.pickups++;
        }
        if (j.returnedAt !== undefined && j.returnedAt >= sixMonthsAgo) {
          const key = monthKey(j.returnedAt);
          if (!monthBuckets.has(key)) {
            monthBuckets.set(key, { key, label: monthLabel(j.returnedAt), pickups: 0, returns: 0 });
          }
          monthBuckets.get(key)!.returns++;
        }
      }
    }

    // Sort books by timesLent descending
    const books = [...bookAgg.entries()]
      .sort((a, b) => b[1].timesLent - a[1].timesLent)
      .map(([bookId, agg]) => ({
        bookId,
        title: agg.title,
        author: agg.author,
        coverImage: agg.coverImage,
        copiesCount: agg.copiesCount,
        timesLent: agg.timesLent,
        uniqueReaders: agg.uniqueReaders.size,
        activeLends: agg.activeLends,
        avgReadingDays:
          agg.completedLends > 0
            ? Math.round((agg.totalReadingDays / agg.completedLends) * 10) / 10
            : null,
        totalReadingDays: Math.round(agg.totalReadingDays),
        bestCondition: agg.bestCondition,
        worstCondition: agg.worstCondition,
      }));

    // Sort monthly activity by key
    const monthlyActivity = [...monthBuckets.values()].sort((a, b) =>
      a.key.localeCompare(b.key),
    );

    return { books, monthlyActivity };
  },
});
