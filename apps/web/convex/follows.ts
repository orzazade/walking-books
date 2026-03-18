import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

export const isFollowing = query({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return false;
    const follow = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", user._id).eq("followingId", args.targetUserId),
      )
      .unique();
    return !!follow;
  },
});

export const toggle = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (user._id === args.targetUserId)
      throw new Error("Cannot follow yourself");
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new Error("User not found");
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", user._id).eq("followingId", args.targetUserId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { following: false };
    }
    await ctx.db.insert("follows", {
      followerId: user._id,
      followingId: args.targetUserId,
    });
    return { following: true };
  },
});

export const followers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.userId))
      .collect();
  },
});

export const following = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();
  },
});
