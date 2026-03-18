import { QueryCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

/** Look up the current user, returning null if not authenticated. */
export async function getCurrentUser(
  ctx: QueryCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/** Look up the current user, throwing if not authenticated or not an admin. */
export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireCurrentUser(ctx);
  if (!user.roles.includes("admin")) throw new Error("Not authorized");
  return user;
}

/** Look up the current user, throwing if not authenticated. */
export async function requireCurrentUser(
  ctx: QueryCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) throw new Error("User not found");
  return user;
}
