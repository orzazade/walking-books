import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { DAY_MS } from "./lib/lending";

/**
 * Community stats — public platform-wide metrics that show community health.
 * Answers "is this platform active?" for new and returning visitors.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * DAY_MS;

    // Total books registered (all-time)
    const allBooks = await ctx.db.query("books").collect();
    const totalBooks = allBooks.length;

    // Total copies in circulation (all-time)
    const allCopies = await ctx.db.query("copies").collect();
    const totalCopies = allCopies.length;
    const availableCopies = allCopies.filter((c) => c.status === "available").length;
    const checkedOutCopies = allCopies.filter((c) => c.status === "checked_out").length;

    // Active sharers (users who have shared at least one book)
    const sharerIds = new Set<Id<"users">>();
    for (const copy of allCopies) {
      sharerIds.add(copy.originalSharerId);
    }

    // Total completed reads (returned journey entries, all-time)
    const allReturns = await ctx.db
      .query("journeyEntries")
      .withIndex("by_returnedAt")
      .collect();
    // Filter to only entries that have returnedAt (index includes null entries at start)
    const completedReads = allReturns.filter(
      (e): e is typeof e & { returnedAt: number } => e.returnedAt !== undefined,
    );

    // Unique readers (users who have completed at least one read)
    const readerIds = new Set<Id<"users">>();
    for (const entry of completedReads) {
      readerIds.add(entry.readerId);
    }

    // Recent activity (last 30 days)
    const recentPickups = await ctx.db
      .query("journeyEntries")
      .withIndex("by_pickedUpAt", (q) => q.gte("pickedUpAt", thirtyDaysAgo))
      .collect();

    const recentReturns = completedReads.filter(
      (e) => e.returnedAt >= thirtyDaysAgo,
    );

    // Total reviews written
    const allReviews = await ctx.db.query("reviews").collect();

    // Total partner locations
    const allLocations = await ctx.db.query("partnerLocations").collect();

    // Most active location (most pickups all-time)
    const locationPickups = new Map<Id<"partnerLocations">, number>();
    for (const entry of allReturns) {
      locationPickups.set(
        entry.pickupLocationId,
        (locationPickups.get(entry.pickupLocationId) ?? 0) + 1,
      );
    }

    let topLocation: { name: string; address: string; pickups: number } | null = null;
    if (locationPickups.size > 0) {
      const sorted = [...locationPickups.entries()].sort((a, b) => b[1] - a[1]);
      const [topLocId, topPickups] = sorted[0];
      const loc = await ctx.db.get(topLocId);
      if (loc) {
        topLocation = { name: loc.name, address: loc.address, pickups: topPickups };
      }
    }

    // Top genre (most books registered in that category)
    const genreCounts = new Map<string, number>();
    for (const book of allBooks) {
      for (const cat of book.categories) {
        genreCounts.set(cat, (genreCounts.get(cat) ?? 0) + 1);
      }
    }
    let topGenre: string | null = null;
    if (genreCounts.size > 0) {
      topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    return {
      totalBooks,
      totalCopies,
      availableCopies,
      checkedOutCopies,
      totalSharers: sharerIds.size,
      totalReaders: readerIds.size,
      completedReads: completedReads.length,
      recentPickups: recentPickups.length,
      recentReturns: recentReturns.length,
      totalReviews: allReviews.length,
      totalLocations: allLocations.length,
      topLocation,
      topGenre,
    };
  },
});
