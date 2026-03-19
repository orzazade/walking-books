import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import { getCurrentUser } from "./lib/auth";

export const vote = mutation({
  args: {
    reviewId: v.id("reviews"),
    helpful: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) throw new Error("Review not found");

    if (review.userId === user._id)
      throw new Error("You cannot vote on your own review");

    const existing = await ctx.db
      .query("reviewVotes")
      .withIndex("by_user_review", (q) =>
        q.eq("userId", user._id).eq("reviewId", args.reviewId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { helpful: args.helpful });
      return existing._id;
    }

    return await ctx.db.insert("reviewVotes", {
      reviewId: args.reviewId,
      userId: user._id,
      helpful: args.helpful,
    });
  },
});

export const remove = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const existing = await ctx.db
      .query("reviewVotes")
      .withIndex("by_user_review", (q) =>
        q.eq("userId", user._id).eq("reviewId", args.reviewId),
      )
      .unique();

    if (!existing) throw new Error("Vote not found");

    await ctx.db.delete(existing._id);
  },
});

export const forReview = query({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("reviewVotes")
      .withIndex("by_review", (q) => q.eq("reviewId", args.reviewId))
      .collect();

    let helpfulCount = 0;
    let unhelpfulCount = 0;
    for (const vote of votes) {
      if (vote.helpful) helpfulCount++;
      else unhelpfulCount++;
    }

    const user = await getCurrentUser(ctx);
    let myVote: boolean | null = null;
    if (user) {
      const userVote = votes.find((v) => v.userId === user._id);
      if (userVote) myVote = userVote.helpful;
    }

    return { helpfulCount, unhelpfulCount, myVote };
  },
});
