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

    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (!trimmed) throw new Error("Location name cannot be empty");
      if (trimmed.length > 200) throw new Error("Location name must be 200 characters or less");
      args = { ...args, name: trimmed };
    }
    if (args.address !== undefined) {
      const trimmed = args.address.trim();
      if (!trimmed) throw new Error("Address cannot be empty");
      if (trimmed.length > 500) throw new Error("Address must be 500 characters or less");
      args = { ...args, address: trimmed };
    }
    if (args.contactPhone !== undefined) {
      const trimmed = args.contactPhone.trim();
      if (trimmed.length > 30) throw new Error("Phone number must be 30 characters or less");
      args = { ...args, contactPhone: trimmed };
    }
    if (args.contactEmail !== undefined) {
      const trimmed = args.contactEmail.trim();
      if (trimmed.length > 200) throw new Error("Email must be 200 characters or less");
      args = { ...args, contactEmail: trimmed };
    }
    if (args.photos !== undefined && args.photos.length > 20)
      throw new Error("Maximum 20 photos allowed");
    if (args.shelfCapacity !== undefined && (!Number.isInteger(args.shelfCapacity) || args.shelfCapacity < 0 || args.shelfCapacity > 10000))
      throw new Error("Shelf capacity must be a non-negative integer up to 10000");

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