import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/** Format a timestamp as YYYY-MM-DD in UTC. */
function toDateString(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Compute the difference in calendar days between two YYYY-MM-DD strings. */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00Z").getTime();
  const b = new Date(dateB + "T00:00:00Z").getTime();
  return Math.round(Math.abs(b - a) / 86_400_000);
}

/**
 * Record reading activity for today and update the user's streak.
 * Called from readingProgress.update whenever a user logs progress.
 */
export async function updateReadingStreak(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const today = toDateString(Date.now());

  const existing = await ctx.db
    .query("readingStreaks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!existing) {
    await ctx.db.insert("readingStreaks", {
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: today,
    });
    return;
  }

  if (existing.lastActiveDate === today) {
    return;
  }

  const gap = daysBetween(existing.lastActiveDate, today);

  if (gap === 1) {
    const newCurrent = existing.currentStreak + 1;
    const newLongest = Math.max(existing.longestStreak, newCurrent);
    await ctx.db.patch(existing._id, {
      currentStreak: newCurrent,
      longestStreak: newLongest,
      lastActiveDate: today,
    });
  } else {
    await ctx.db.patch(existing._id, {
      currentStreak: 1,
      longestStreak: Math.max(existing.longestStreak, 1),
      lastActiveDate: today,
    });
  }
}
