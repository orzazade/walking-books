import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

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
    const today = new Date();
    const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
    const lastActive = new Date(streak.lastActiveDate + "T00:00:00Z");
    const todayDate = new Date(todayStr + "T00:00:00Z");
    const gapDays = Math.round(
      (todayDate.getTime() - lastActive.getTime()) / 86_400_000,
    );

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
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const streak = await ctx.db
      .query("readingStreaks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!streak) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const today = new Date();
    const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
    const lastActive = new Date(streak.lastActiveDate + "T00:00:00Z");
    const todayDate = new Date(todayStr + "T00:00:00Z");
    const gapDays = Math.round(
      (todayDate.getTime() - lastActive.getTime()) / 86_400_000,
    );

    return {
      currentStreak: gapDays <= 1 ? streak.currentStreak : 0,
      longestStreak: streak.longestStreak,
    };
  },
});
