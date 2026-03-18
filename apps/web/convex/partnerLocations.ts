import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

export const myLocation = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    // Check as manager first
    const managed = await ctx.db
      .query("partnerLocations")
      .withIndex("by_manager", (q) => q.eq("managedByUserId", user._id))
      .first();
    if (managed) return managed;

    // Check as staff
    const all = await ctx.db.query("partnerLocations").collect();
    return all.find((loc) => loc.staffUserIds.includes(user._id)) ?? null;
  },
});

export const update = mutation({
  args: {
    locationId: v.id("partnerLocations"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    operatingHours: v.optional(v.any()),
    shelfCapacity: v.optional(v.number()),
    photos: v.optional(v.array(v.string())),
    staffUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");
    if (location.managedByUserId !== user._id)
      throw new Error("Only the manager can update location settings");

    const { locationId, ...rest } = args;
    const updates = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    );
    await ctx.db.patch(locationId, updates);
    return { success: true };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("partnerLocations").collect();
  },
});

export const byId = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.locationId);
  },
});