import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

export const setGoal = mutation({
  args: { year: v.number(), targetBooks: v.number() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (!Number.isInteger(args.targetBooks) || args.targetBooks < 1 || args.targetBooks > 1000)
      throw new Error("Target must be between 1 and 1000");
    if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2100)
      throw new Error("Invalid year");

    const existing = await ctx.db
      .query("readingGoals")
      .withIndex("by_user_year", (q) =>
        q.eq("userId", user._id).eq("year", args.year),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { targetBooks: args.targetBooks });
      return { _id: existing._id };
    }

    const id = await ctx.db.insert("readingGoals", {
      userId: user._id,
      year: args.year,
      targetBooks: args.targetBooks,
    });
    return { _id: id };
  },
});

export const removeGoal = mutation({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("readingGoals")
      .withIndex("by_user_year", (q) =>
        q.eq("userId", user._id).eq("year", args.year),
      )
      .unique();
    if (!existing) throw new Error("No reading goal found for this year");
    await ctx.db.delete(existing._id);
  },
});

export const getProgress = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    // Count completed reads (journeyEntries with returnedAt) in the given year
    const yearStart = new Date(args.year, 0, 1).getTime();
    const yearEnd = new Date(args.year + 1, 0, 1).getTime();

    const [goal, completedEntries] = await Promise.all([
      ctx.db
        .query("readingGoals")
        .withIndex("by_user_year", (q) =>
          q.eq("userId", user._id).eq("year", args.year),
        )
        .unique(),
      ctx.db
        .query("journeyEntries")
        .withIndex("by_reader", (q) => q.eq("readerId", user._id))
        .filter((q) =>
          q.and(
            q.neq(q.field("returnedAt"), undefined),
            q.gte(q.field("returnedAt"), yearStart),
            q.lt(q.field("returnedAt"), yearEnd),
          ),
        )
        .collect(),
    ]);

    const completedReads = completedEntries.length;

    return {
      year: args.year,
      targetBooks: goal?.targetBooks ?? null,
      completedReads,
      progressPercent: goal && goal.targetBooks > 0
        ? Math.min(
            100,
            Math.round((completedReads / goal.targetBooks) * 100),
          )
        : null,
    };
  },
});
