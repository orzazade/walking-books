import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { DAY_MS } from "./lib/lending";
import { toDateString, daysBetween } from "./lib/streaks";

/**
 * Community leaderboard — public rankings that drive engagement.
 * Top readers (completed reads), top sharers (books lent), longest streaks.
 */

/** Top readers by completed reads in the last 30 days. */
export const topReaders = query({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * DAY_MS;

    // Get recently completed journey entries (returned in last 30 days)
    const recentReturns = await ctx.db
      .query("journeyEntries")
      .withIndex("by_pickedUpAt", (q) => q.gte("pickedUpAt", thirtyDaysAgo))
      .collect();

    // Count completed reads per reader
    const readerCounts = new Map<Id<"users">, number>();
    for (const entry of recentReturns) {
      if (entry.returnedAt !== undefined) {
        readerCounts.set(
          entry.readerId,
          (readerCounts.get(entry.readerId) ?? 0) + 1,
        );
      }
    }

    if (readerCounts.size === 0) return [];

    // Sort by count descending, take top 10
    const sorted = [...readerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const results = await Promise.all(
      sorted.map(async ([userId, completedReads]) => {
        const user = await ctx.db.get(userId);
        if (!user) return null;
        return {
          userId: user._id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          completedReads,
          booksRead: user.booksRead,
          reputationScore: user.reputationScore,
        };
      }),
    );

    return results.filter((r) => r !== null);
  },
});

/** Top sharers by books lent out in the last 30 days. */
export const topSharers = query({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * DAY_MS;

    // Get recent pickups (journey entries started in last 30 days)
    const recentPickups = await ctx.db
      .query("journeyEntries")
      .withIndex("by_pickedUpAt", (q) => q.gte("pickedUpAt", thirtyDaysAgo))
      .collect();

    // Map copies to their sharers
    const copyIds = new Set<Id<"copies">>();
    for (const entry of recentPickups) {
      copyIds.add(entry.copyId);
    }

    const copyDocs = await Promise.all(
      [...copyIds].map((id) => ctx.db.get(id)),
    );
    const copyToSharer = new Map<Id<"copies">, Id<"users">>();
    for (const doc of copyDocs) {
      if (doc) copyToSharer.set(doc._id, doc.originalSharerId);
    }

    // Count lends per sharer
    const sharerCounts = new Map<Id<"users">, number>();
    for (const entry of recentPickups) {
      const sharerId = copyToSharer.get(entry.copyId);
      if (sharerId) {
        sharerCounts.set(sharerId, (sharerCounts.get(sharerId) ?? 0) + 1);
      }
    }

    if (sharerCounts.size === 0) return [];

    const sorted = [...sharerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const results = await Promise.all(
      sorted.map(async ([userId, booksLent]) => {
        const user = await ctx.db.get(userId);
        if (!user) return null;
        return {
          userId: user._id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          booksLent,
          booksShared: user.booksShared,
          reputationScore: user.reputationScore,
        };
      }),
    );

    return results.filter((r) => r !== null);
  },
});

/** Top reading streaks — longest current streaks in the community. */
export const topStreaks = query({
  args: {},
  handler: async (ctx) => {
    const allStreaks = await ctx.db.query("readingStreaks").collect();

    if (allStreaks.length === 0) return [];

    const todayStr = toDateString(Date.now());

    // Filter to active streaks only (last activity today or yesterday)
    const activeStreaks = allStreaks
      .filter((s) => daysBetween(s.lastActiveDate, todayStr) <= 1)
      .map((s) => ({
        userId: s.userId,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
      }));

    // Sort by current streak descending, take top 10
    const sorted = activeStreaks
      .sort((a, b) => b.currentStreak - a.currentStreak)
      .slice(0, 10);

    if (sorted.length === 0) return [];

    const results = await Promise.all(
      sorted.map(async (streak) => {
        const user = await ctx.db.get(streak.userId);
        if (!user) return null;
        return {
          userId: user._id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
        };
      }),
    );

    return results.filter((r) => r !== null);
  },
});
