import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

export const createFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    phone: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      phone: args.phone,
      name: args.name,
      avatarUrl: args.avatarUrl,
      bio: undefined,
      roles: ["reader"],
      status: "active",
      reputationScore: 50,
      booksShared: 0,
      booksRead: 0,
      favoriteGenres: [],
    });
  },
});

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      phone: identity.phoneNumber ?? "",
      name: identity.name ?? "Reader",
      avatarUrl: identity.pictureUrl ?? undefined,
      bio: undefined,
      roles: ["reader"],
      status: "active",
      reputationScore: 50,
      booksShared: 0,
      booksRead: 0,
      favoriteGenres: [],
    });
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkId", identity.subject),
      )
      .unique();
  },
});

export const profile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    favoriteGenres: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;
    if (args.favoriteGenres !== undefined)
      updates.favoriteGenres = args.favoriteGenres;
    await ctx.db.patch(user._id, updates);
  },
});

export const recalculateReputation = internalMutation({
  args: {},
  handler: async () => {
    // TODO: recalculate reputation scores based on full history
  },
});

// ── Admin-only queries & mutations ──────────────────────────────────

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!caller || !caller.roles.includes("admin")) return [];
    return await ctx.db.query("users").collect();
  },
});

export const updateStatus = mutation({
  args: {
    userId: v.id("users"),
    status: v.union(
      v.literal("active"),
      v.literal("restricted"),
      v.literal("banned"),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!caller || !caller.roles.includes("admin")) {
      throw new Error("Not authorized");
    }
    await ctx.db.patch(args.userId, { status: args.status });
  },
});

export const updateRoles = mutation({
  args: {
    userId: v.id("users"),
    roles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!caller || !caller.roles.includes("admin")) {
      throw new Error("Not authorized");
    }
    await ctx.db.patch(args.userId, { roles: args.roles });
  },
});
