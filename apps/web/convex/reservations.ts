import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { REPUTATION, clampScore, getUserRestrictions } from "./lib/reputation";
import { HOUR_MS, RESERVATION_EXPIRY_HOURS } from "./lib/lending";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

export const active = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
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
    const user = await requireCurrentUser(ctx);

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
    const expiresAt = now + RESERVATION_EXPIRY_HOURS * HOUR_MS;

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
    const user = await requireCurrentUser(ctx);

    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) throw new Error("Reservation not found");
    if (reservation.status !== "active")
      throw new Error("Reservation is not active");
    if (user._id !== reservation.userId)
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
    return await ctx.db
      .query("reservations")
      .withIndex("by_location", (q) =>
        q.eq("locationId", args.locationId).eq("status", "active"),
      )
      .collect();
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

      // Fetch copy and user in parallel
      const [copy, user] = await Promise.all([
        ctx.db.get(reservation.copyId),
        ctx.db.get(reservation.userId),
      ]);

      // Release copy
      if (copy && copy.status === "reserved") {
        await ctx.db.patch(reservation.copyId, { status: "available" });
      }

      // Apply no-show penalty
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
