import { v } from "convex/values";
import { query } from "./_generated/server";

export const byReader = query({
  args: { readerId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journeyEntries")
      .withIndex("by_reader", (q) => q.eq("readerId", args.readerId))
      .collect();
  },
});
