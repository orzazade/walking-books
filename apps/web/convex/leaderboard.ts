import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { DAY_MS } from "./lib/lending";
import { toDateString, daysBetween } from "./lib/streaks";

/** Fetch user docs for ranked entries, shape results, and filter deleted users. */
async function enrichTopUsers<T extends { userId: Id<"users"> }, R>(
  ctx: QueryCtx,
  items: T[],
  mapFn: (user: Doc<"users">, item: T) => R,
): Promise<R[]> {
  const results = await Promise.all(
    items.map(async (item) => {
      const user = await ctx.db.get(item.userId);
      if (!user) return null;
      return mapFn(user, item);
    }),
  );
  return results.filter((r) => r !== null) as R[];
}

/**
 * Community leaderboard — public rankings that drive engagement.
 * Top readers (completed reads), top sharers (books lent), longest streaks.
 */

/** Top readers by completed reads in the last 30 days. */
export const topReaders = query({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * DAY_MS;

    // Get journey entries returned in the last 30 days using by_returnedAt index
    const recentReturns = await ctx.db
      .query("journeyEntries")
      .withIndex("by_returnedAt", (q) => q.gte("returnedAt", thirtyDaysAgo))
      .collect();

    // Count completed reads per reader
    const readerCounts = new Map<Id<"users">, number>();
    for (const entry of recentReturns) {
      readerCounts.set(
        entry.readerId,
        (readerCounts.get(entry.readerId) ?? 0) + 1,
      );
    }

    if (readerCounts.size === 0) return [];

    // Sort by count descending, take top 10
    const sorted = [...readerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, completedReads]) => ({ userId, completedReads }));

    return enrichTopUsers(ctx, sorted, (user, { completedReads }) => ({
      userId: user._id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      completedReads,
      booksRead: user.booksRead,
      reputationScore: user.reputationScore,
    }));
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
      .slice(0, 10)
      .map(([userId, booksLent]) => ({ userId, booksLent }));

    return enrichTopUsers(ctx, sorted, (user, { booksLent }) => ({
      userId: user._id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      booksLent,
      booksShared: user.booksShared,
      reputationScore: user.reputationScore,
    }));
  },
});

/** Top reading streaks — longest current streaks in the community. */
export const topStreaks = query({
  args: {},
  handler: async (ctx) => {
    const todayStr = toDateString(Date.now());
    const yesterdayStr = toDateString(Date.now() - DAY_MS);

    // Use by_lastActiveDate index to fetch only active streaks (today or yesterday)
    const recentStreaks = await ctx.db
      .query("readingStreaks")
      .withIndex("by_lastActiveDate", (q) => q.gte("lastActiveDate", yesterdayStr))
      .collect();

    if (recentStreaks.length === 0) return [];

    // Filter to exactly today/yesterday (index may include future dates if any)
    const activeStreaks = recentStreaks
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

    return enrichTopUsers(ctx, sorted, (user, streak) => ({
      userId: user._id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
    }));
  },
});
