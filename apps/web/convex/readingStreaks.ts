import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";
import { toDateString, daysBetween } from "./lib/streaks";

/** Get the current user's reading streak. */
export const getStreak = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const streak = await ctx.db
      .query("readingStreaks")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!streak) {
      return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
    }

    // Check if the streak is still active (last activity was today or yesterday)
    const todayStr = toDateString(Date.now());
    const gapDays = daysBetween(streak.lastActiveDate, todayStr);

    return {
      currentStreak: gapDays <= 1 ? streak.currentStreak : 0,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
    };
  },
});

/** Get a user's reading streak by user ID (public profile). */
export const forUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const [user, streak] = await Promise.all([
      ctx.db.get(args.userId),
      ctx.db
        .query("readingStreaks")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first(),
    ]);
    if (!user) return null;

    if (!streak) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const todayStr = toDateString(Date.now());
    const gapDays = daysBetween(streak.lastActiveDate, todayStr);

    return {
      currentStreak: gapDays <= 1 ? streak.currentStreak : 0,
      longestStreak: streak.longestStreak,
    };
  },
});
