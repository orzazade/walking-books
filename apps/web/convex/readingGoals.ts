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

    // Annual goals have month=undefined — use the dedicated index to find them
    const existing = await ctx.db
      .query("readingGoals")
      .withIndex("by_user_year_month", (q) =>
        q.eq("userId", user._id).eq("year", args.year).eq("month", undefined),
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
    if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2100)
      throw new Error("Invalid year");
    const existing = await ctx.db
      .query("readingGoals")
      .withIndex("by_user_year_month", (q) =>
        q.eq("userId", user._id).eq("year", args.year).eq("month", undefined),
      )
      .unique();
    if (!existing) throw new Error("No reading goal found for this year");
    await ctx.db.delete(existing._id);
  },
});

export const setMonthlyGoal = mutation({
  args: { year: v.number(), month: v.number(), targetBooks: v.number() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (!Number.isInteger(args.targetBooks) || args.targetBooks < 1 || args.targetBooks > 100)
      throw new Error("Monthly target must be between 1 and 100");
    if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2100)
      throw new Error("Invalid year");
    if (!Number.isInteger(args.month) || args.month < 1 || args.month > 12)
      throw new Error("Month must be between 1 and 12");

    const existing = await ctx.db
      .query("readingGoals")
      .withIndex("by_user_year_month", (q) =>
        q.eq("userId", user._id).eq("year", args.year).eq("month", args.month),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { targetBooks: args.targetBooks });
      return { _id: existing._id };
    }

    const id = await ctx.db.insert("readingGoals", {
      userId: user._id,
      year: args.year,
      month: args.month,
      targetBooks: args.targetBooks,
    });
    return { _id: id };
  },
});

export const removeMonthlyGoal = mutation({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2100)
      throw new Error("Invalid year");
    if (!Number.isInteger(args.month) || args.month < 1 || args.month > 12)
      throw new Error("Month must be between 1 and 12");
    const existing = await ctx.db
      .query("readingGoals")
      .withIndex("by_user_year_month", (q) =>
        q.eq("userId", user._id).eq("year", args.year).eq("month", args.month),
      )
      .unique();
    if (!existing) throw new Error("No monthly goal found");
    await ctx.db.delete(existing._id);
  },
});

export const getMonthlyProgress = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    // Fetch all monthly goals for this year
    const allGoals = await ctx.db
      .query("readingGoals")
      .withIndex("by_user_year", (q) =>
        q.eq("userId", user._id).eq("year", args.year),
      )
      .collect();

    const monthlyGoals = allGoals.filter((g) => g.month !== undefined);

    // Fetch all completed reads for the year
    const yearStart = new Date(args.year, 0, 1).getTime();
    const yearEnd = new Date(args.year + 1, 0, 1).getTime();

    const completedEntries = await ctx.db
      .query("journeyEntries")
      .withIndex("by_reader", (q) => q.eq("readerId", user._id))
      .filter((q) =>
        q.and(
          q.neq(q.field("returnedAt"), undefined),
          q.gte(q.field("returnedAt"), yearStart),
          q.lt(q.field("returnedAt"), yearEnd),
        ),
      )
      .collect();

    // Group completed reads by month
    const readsByMonth = new Map<number, number>();
    for (const entry of completedEntries) {
      if (entry.returnedAt === undefined) continue;
      const month = new Date(entry.returnedAt).getMonth() + 1; // 1-indexed
      readsByMonth.set(month, (readsByMonth.get(month) ?? 0) + 1);
    }

    // Build per-month progress
    const months: {
      month: number;
      targetBooks: number | null;
      completedReads: number;
      progressPercent: number | null;
    }[] = [];

    for (let m = 1; m <= 12; m++) {
      const goal = monthlyGoals.find((g) => g.month === m);
      const completed = readsByMonth.get(m) ?? 0;
      const target = goal?.targetBooks ?? null;
      months.push({
        month: m,
        targetBooks: target,
        completedReads: completed,
        progressPercent:
          target && target > 0
            ? Math.min(100, Math.round((completed / target) * 100))
            : null,
      });
    }

    return { year: args.year, months };
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
        .withIndex("by_user_year_month", (q) =>
          q.eq("userId", user._id).eq("year", args.year).eq("month", undefined),
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
