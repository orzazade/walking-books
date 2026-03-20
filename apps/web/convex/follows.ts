import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";
import type { Doc } from "./_generated/dataModel";

function toPublicProfile(user: Doc<"users">) {
  return {
    _id: user._id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    booksRead: user.booksRead,
    booksShared: user.booksShared,
    reputationScore: user.reputationScore,
    favoriteGenres: user.favoriteGenres,
  };
}

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
    const [user, target] = await Promise.all([
      requireCurrentUser(ctx),
      ctx.db.get(args.targetUserId),
    ]);
    if (!target) throw new Error("User not found");
    if (user._id === args.targetUserId)
      throw new Error("Cannot follow yourself");
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
    const MAX_FOLLOWING = 500;
    const followCount = (
      await ctx.db
        .query("follows")
        .withIndex("by_follower", (q) => q.eq("followerId", user._id))
        .collect()
    ).length;
    if (followCount >= MAX_FOLLOWING)
      throw new Error(`Maximum ${MAX_FOLLOWING} users can be followed`);
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

export const myFollowingEnriched = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", user._id))
      .collect();
    const users = await Promise.all(
      follows.map((f) => ctx.db.get(f.followingId)),
    );
    return users
      .filter((u) => u !== null)
      .map(toPublicProfile);
  },
});

export const friendsReading = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // Get people the current user follows
    const followRows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", user._id))
      .collect();
    if (followRows.length === 0) return [];

    // Batch-fetch copies held by each followed user
    const followedIds = followRows.map((f) => f.followingId);
    const copiesPerUser = await Promise.all(
      followedIds.map((uid) =>
        ctx.db
          .query("copies")
          .withIndex("by_holder", (q) => q.eq("currentHolderId", uid))
          .collect(),
      ),
    );

    // Build a flat list of { userId, copy } pairs
    const heldItems: { userId: typeof followedIds[number]; copyId: typeof copiesPerUser[0][0]["_id"]; bookId: typeof copiesPerUser[0][0]["bookId"] }[] = [];
    for (let i = 0; i < followedIds.length; i++) {
      for (const copy of copiesPerUser[i]) {
        heldItems.push({ userId: followedIds[i], bookId: copy.bookId, copyId: copy._id });
      }
    }
    if (heldItems.length === 0) return [];

    // Batch-fetch unique users and books
    const uniqueUserIds = [...new Set(heldItems.map((h) => h.userId))];
    const uniqueBookIds = [...new Set(heldItems.map((h) => h.bookId))];

    const [users, books] = await Promise.all([
      Promise.all(uniqueUserIds.map((id) => ctx.db.get(id))),
      Promise.all(uniqueBookIds.map((id) => ctx.db.get(id))),
    ]);

    const userMap = new Map(uniqueUserIds.map((id, i) => [id, users[i]]));
    const bookMap = new Map(uniqueBookIds.map((id, i) => [id, books[i]]));

    // Assemble results (limit to 10 most recent)
    return heldItems
      .slice(0, 10)
      .map((h) => {
        const u = userMap.get(h.userId);
        const b = bookMap.get(h.bookId);
        if (!u || !b) return null;
        return {
          userId: u._id,
          userName: u.name,
          avatarUrl: u.avatarUrl,
          bookId: b._id,
          bookTitle: b.title,
          bookAuthor: b.author,
          coverImage: b.coverImage,
        };
      })
      .filter((r) => r !== null);
  },
});

export const myFollowersEnriched = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", user._id))
      .collect();
    const users = await Promise.all(
      follows.map((f) => ctx.db.get(f.followerId)),
    );
    return users
      .filter((u) => u !== null)
      .map(toPublicProfile);
  },
});
