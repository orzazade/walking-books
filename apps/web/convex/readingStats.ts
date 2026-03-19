import { v } from "convex/values";
import { query } from "./_generated/server";
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

    const entries = await ctx.db
      .query("journeyEntries")
      .withIndex("by_reader", (q) => q.eq("readerId", targetUserId))
      .collect();

    const completedReads = entries.filter(
      (e): e is typeof e & { returnedAt: number } => e.returnedAt !== undefined,
    );
    const inProgress = entries.filter((e) => e.returnedAt === undefined);

    // Average days per book (completed reads only)
    let avgDaysPerBook: number | null = null;
    if (completedReads.length > 0) {
      const totalDays = completedReads.reduce((sum, e) => {
        const days = (e.returnedAt - e.pickedUpAt) / DAY_MS;
        return sum + days;
      }, 0);
      avgDaysPerBook = Math.round((totalDays / completedReads.length) * 10) / 10;
    }

    // Genre breakdown from completed reads (batch lookups to avoid N+1)
    const copies = await Promise.all(
      completedReads.map((e) => ctx.db.get(e.copyId)),
    );
    const uniqueBookIds = [...new Set(
      copies.filter((c) => c !== null).map((c) => c.bookId),
    )];
    const books = await Promise.all(
      uniqueBookIds.map((id) => ctx.db.get(id)),
    );
    const bookMap = new Map(
      books.filter((b) => b !== null).map((b) => [b._id, b]),
    );

    const genreCounts: Record<string, number> = {};
    for (const copy of copies) {
      if (!copy) continue;
      const book = bookMap.get(copy.bookId);
      if (!book) continue;
      for (const genre of book.categories) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
    }

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));

    // Monthly reading activity (last 12 months)
    const now = Date.now();
    const monthlyActivity: { month: string; count: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();

      const count = completedReads.filter(
        (e) => e.returnedAt >= monthStart && e.returnedAt < monthEnd,
      ).length;

      const label = new Date(monthStart).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      monthlyActivity.push({ month: label, count });
    }

    // Unique locations visited
    const uniqueLocations = new Set(
      entries.map((e) => e.pickupLocationId),
    ).size;

    return {
      totalBooksRead: completedReads.length,
      currentlyReading: inProgress.length,
      avgDaysPerBook,
      topGenres,
      monthlyActivity,
      uniqueLocationsVisited: uniqueLocations,
    };
  },
});
