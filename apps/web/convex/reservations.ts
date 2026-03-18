import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { REPUTATION, clampScore, getUserRestrictions } from "./lib/reputation";

export const active = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];
    return await ctx.db
      .query("reservations")
      .withIndex("by_user", (q) =>
        q.eq("userId", user._id).eq("status", "active"),
      )
      .collect();
  },
});

export const create = mutation({
  args: {
    copyId: v.id("copies"),
    locationId: v.id("partnerLocations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    // Check reputation restrictions
    const restrictions = getUserRestrictions(user.reputationScore);
    if (!restrictions.canReserve)
      throw new Error("Your reputation is too low to reserve books");

    // Check max books
    const activeReservations = await ctx.db
      .query("reservations")
      .withIndex("by_user", (q) =>
        q.eq("userId", user._id).eq("status", "active"),
      )
      .collect();
    if (activeReservations.length >= restrictions.maxBooks)
      throw new Error("Maximum active reservations reached");

    // Check copy is available
    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");
    if (copy.status !== "available")
      throw new Error("Copy is not available for reservation");

    // Check no existing reservation by this user for this copy
    const existingReservation = await ctx.db
      .query("reservations")
      .withIndex("by_copy", (q) =>
        q.eq("copyId", args.copyId).eq("status", "active"),
      )
      .first();
    if (existingReservation)
      throw new Error("This copy already has an active reservation");

    const now = Date.now();
    const expiresAt = now + 60 * 60 * 1000; // 1-hour expiry

    // Create reservation
    const reservationId = await ctx.db.insert("reservations", {
      copyId: args.copyId,
      userId: user._id,
      locationId: args.locationId,
      reservedAt: now,
      expiresAt,
      status: "active",
    });

    // Set copy to reserved
    await ctx.db.patch(args.copyId, { status: "reserved" });

    return { reservationId, expiresAt };
  },
});

export const cancel = mutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) throw new Error("Reservation not found");
    if (reservation.status !== "active")
      throw new Error("Reservation is not active");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || user._id !== reservation.userId)
      throw new Error("Not your reservation");

    await ctx.db.patch(args.reservationId, { status: "cancelled" });

    // Release copy
    const copy = await ctx.db.get(reservation.copyId);
    if (copy && copy.status === "reserved") {
      await ctx.db.patch(reservation.copyId, { status: "available" });
    }

    return { success: true };
  },
});

export const byLocation = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    // Get all active reservations and filter by location
    const allActive = await ctx.db
      .query("reservations")
      .withIndex("by_expiry", (q) => q.eq("status", "active"))
      .collect();
    return allActive.filter((r) => r.locationId === args.locationId);
  },
});

export const expireStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const staleReservations = await ctx.db
      .query("reservations")
      .withIndex("by_expiry", (q) =>
        q.eq("status", "active").lt("expiresAt", now),
      )
      .collect();

    for (const reservation of staleReservations) {

      // Expire reservation
      await ctx.db.patch(reservation._id, { status: "expired" });

      // Release copy
      const copy = await ctx.db.get(reservation.copyId);
      if (copy && copy.status === "reserved") {
        await ctx.db.patch(reservation.copyId, { status: "available" });
      }

      // Apply no-show penalty
      const user = await ctx.db.get(reservation.userId);
      if (user) {
        await ctx.db.patch(user._id, {
          reputationScore: clampScore(
            user.reputationScore + REPUTATION.NO_SHOW,
          ),
        });
      }
    }
  },
});
