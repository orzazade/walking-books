import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser, requireAdmin } from "./lib/auth";
import { userStatusValidator } from "./lib/validators";

const DEFAULT_USER_FIELDS = {
  roles: ["reader"],
  status: "active" as const,
  reputationScore: 50,
  booksShared: 0,
  booksRead: 0,
  favoriteGenres: [] as string[],
};

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
      ...DEFAULT_USER_FIELDS,
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
      ...DEFAULT_USER_FIELDS,
    });
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => getCurrentUser(ctx),
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
    const user = await requireCurrentUser(ctx);
    if (args.name !== undefined && args.name.trim().length === 0)
      throw new Error("Name cannot be empty");
    const updates = Object.fromEntries(
      Object.entries(args).filter(([, v]) => v !== undefined),
    );
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
    const admin = await getCurrentUser(ctx);
    if (!admin || !admin.roles.includes("admin")) return [];
    return await ctx.db.query("users").collect();
  },
});

export const updateStatus = mutation({
  args: {
    userId: v.id("users"),
    status: userStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(args.userId, { status: args.status });
  },
});

export const updateRoles = mutation({
  args: {
    userId: v.id("users"),
    roles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const validRoles = ["reader", "partner", "admin"];
    const invalid = args.roles.filter((r) => !validRoles.includes(r));
    if (invalid.length > 0) throw new Error(`Invalid roles: ${invalid.join(", ")}`);
    if (args.roles.length === 0) throw new Error("At least one role required");
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(args.userId, { roles: args.roles });
  },
});
