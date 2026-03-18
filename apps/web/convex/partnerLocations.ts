import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const myLocation = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");
    if (location.managedByUserId !== user._id)
      throw new Error("Only the manager can update location settings");

    const { locationId, ...updates } = args;
    const cleanUpdates: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) cleanUpdates[key] = val;
    }
    await ctx.db.patch(locationId, cleanUpdates);
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

export const nearby = query({
  args: {
    minLat: v.number(),
    maxLat: v.number(),
    minLng: v.number(),
    maxLng: v.number(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("partnerLocations").collect();
    return all.filter(
      (loc) =>
        loc.lat >= args.minLat &&
        loc.lat <= args.maxLat &&
        loc.lng >= args.minLng &&
        loc.lng <= args.maxLng,
    );
  },
});
