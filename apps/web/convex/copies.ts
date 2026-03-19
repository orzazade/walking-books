import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getEffectiveLendingDays, DAY_MS, RECALL_GRACE_DAYS } from "./lib/lending";
import { REPUTATION, clampScore, calculateReturnRepChange, getUserRestrictions } from "./lib/reputation";
import { conditionValidator, CONDITION_LABELS } from "./lib/validators";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";
import { notifyNextWaiter } from "./lib/waitlist";

export const byBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("copies")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
  },
});

export const byId = query({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.copyId);
  },
});

export const journey = query({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journeyEntries")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .collect();
  },
});

export const byLocation = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("copies")
      .withIndex("by_location", (q) =>
        q.eq("currentLocationId", args.locationId).eq("status", "available"),
      )
      .collect();
  },
});

export const allAtLocation = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("copies")
      .withIndex("by_location", (q) => q.eq("currentLocationId", args.locationId))
      .collect();
  },
});

export const byHolder = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("copies")
      .withIndex("by_holder", (q) => q.eq("currentHolderId", user._id))
      .collect();
  },
});

export const bySharer = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("copies")
      .withIndex("by_sharer", (q) => q.eq("originalSharerId", user._id))
      .collect();
  },
});

export const pickup = mutation({
  args: {
    copyId: v.id("copies"),
    locationId: v.id("partnerLocations"),
    reservationId: v.optional(v.id("reservations")),
    conditionAtPickup: conditionValidator,
    photos: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");

    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");
    if (copy.status !== "available" && copy.status !== "reserved")
      throw new Error("Copy not available for pickup");

    // Fulfill reservation if provided
    if (args.reservationId) {
      const reservation = await ctx.db.get(args.reservationId);
      if (reservation && reservation.status === "active") {
        await ctx.db.patch(args.reservationId, { status: "fulfilled" });
      }
    }

    // Calculate lending period
    const book = await ctx.db.get(copy.bookId);
    const pageCount = book?.pageCount ?? 200;
    let lendingDays = getEffectiveLendingDays(
      pageCount,
      copy.sharerMaxLendingDays,
    );

    // Warning zone: cap at 14 days for users with score 30-49
    const restrictions = getUserRestrictions(user.reputationScore);
    if (restrictions.tier === "warning") {
      lendingDays = Math.min(lendingDays, 14);
    }

    const now = Date.now();
    const returnDeadline =
      copy.ownershipType === "lent"
        ? now + lendingDays * DAY_MS
        : undefined;

    // Update copy
    await ctx.db.patch(args.copyId, {
      status: "checked_out",
      currentHolderId: user._id,
      returnDeadline,
      lendingPeriodDays: lendingDays,
    });

    // Create journey entry
    await ctx.db.insert("journeyEntries", {
      copyId: args.copyId,
      readerId: user._id,
      pickupLocationId: args.locationId,
      pickedUpAt: now,
      conditionAtPickup: args.conditionAtPickup,
      pickupPhotos: args.photos,
      returnPhotos: [],
      reservationId: args.reservationId,
    });

    // Create condition report
    await ctx.db.insert("conditionReports", {
      copyId: args.copyId,
      reportedByUserId: user._id,
      type: "pickup_check",
      photos: args.photos,
      description: `Pickup condition: ${CONDITION_LABELS[args.conditionAtPickup]}`,
      previousCondition: copy.condition,
      newCondition: args.conditionAtPickup,
      createdAt: now,
    });

    // Update user booksRead
    await ctx.db.patch(user._id, { booksRead: user.booksRead + 1 });

    return { success: true };
  },
});

export const returnCopy = mutation({
  args: {
    copyId: v.id("copies"),
    locationId: v.id("partnerLocations"),
    conditionAtReturn: conditionValidator,
    photos: v.array(v.string()),
    readerNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");

    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");
    if (copy.currentHolderId !== user._id)
      throw new Error("You are not the current holder");

    const now = Date.now();

    // Calculate and apply reputation change
    const repChange = calculateReturnRepChange({
      isOnTime: !copy.returnDeadline || now <= copy.returnDeadline,
      condition: args.conditionAtReturn,
      hasNote: !!args.readerNote,
    });
    await ctx.db.patch(user._id, {
      reputationScore: clampScore(user.reputationScore + repChange),
    });

    // Keep recalled status if owner recalled; otherwise make available again
    const newStatus = copy.status === "recalled" ? "recalled" : "available";

    // Update copy — set condition to what the returner observed
    await ctx.db.patch(args.copyId, {
      status: newStatus,
      condition: args.conditionAtReturn,
      currentHolderId: undefined,
      currentLocationId: args.locationId,
      returnDeadline: undefined,
    });

    // Close journey entry — filter + first to avoid collecting all history
    const openEntry = await ctx.db
      .query("journeyEntries")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .filter((q) =>
        q.and(
          q.eq(q.field("readerId"), user._id),
          q.eq(q.field("returnedAt"), undefined),
        ),
      )
      .first();
    if (openEntry) {
      await ctx.db.patch(openEntry._id, {
        returnedAt: now,
        conditionAtReturn: args.conditionAtReturn,
        dropoffLocationId: args.locationId,
        returnPhotos: args.photos,
        readerNote: args.readerNote,
      });
    } else {
      console.warn(
        `returnCopy: no open journey entry found for copy ${args.copyId} and user ${user._id}`,
      );
    }

    // Create condition report
    await ctx.db.insert("conditionReports", {
      copyId: args.copyId,
      reportedByUserId: user._id,
      type: "return_check",
      photos: args.photos,
      description: `Return condition: ${CONDITION_LABELS[args.conditionAtReturn]}`,
      previousCondition: copy.condition,
      newCondition: args.conditionAtReturn,
      createdAt: now,
    });

    // Notify the next person on the waitlist if the copy is now available
    if (newStatus === "available") {
      await notifyNextWaiter(ctx, copy.bookId, args.copyId, now);
    }

    return { success: true, reputationChange: repChange };
  },
});

export const recall = mutation({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");
    if (copy.originalSharerId !== user._id)
      throw new Error("Only the sharer can recall");

    if (copy.status === "available") {
      await ctx.db.patch(args.copyId, { status: "recalled" });
    } else if (copy.status === "checked_out") {
      const graceDeadline = Date.now() + RECALL_GRACE_DAYS * DAY_MS;
      const newDeadline =
        copy.returnDeadline && copy.returnDeadline < graceDeadline
          ? copy.returnDeadline
          : graceDeadline;
      await ctx.db.patch(args.copyId, {
        status: "recalled",
        returnDeadline: newDeadline,
      });
    } else {
      throw new Error("Cannot recall copy in current status");
    }

    return { success: true };
  },
});

export const extend = mutation({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");
    if (copy.currentHolderId !== user._id)
      throw new Error("You are not the current holder");
    if (copy.status !== "checked_out")
      throw new Error("Copy is not checked out");
    if (!copy.returnDeadline)
      throw new Error("This copy has no return deadline to extend");

    // Check no active reservation waiting
    const activeReservation = await ctx.db
      .query("reservations")
      .withIndex("by_copy", (q) =>
        q.eq("copyId", args.copyId).eq("status", "active"),
      )
      .first();
    if (activeReservation)
      throw new Error("Cannot extend: there is an active reservation");

    // Extend by 50% of original period
    const originalDays = copy.lendingPeriodDays ?? 21;
    const extensionDays = Math.ceil(originalDays * 0.5);
    const currentDeadline = copy.returnDeadline;
    const newDeadline =
      currentDeadline + extensionDays * DAY_MS;

    await ctx.db.patch(args.copyId, { returnDeadline: newDeadline });

    return { success: true, newDeadline, extensionDays };
  },
});

export const processOverdue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const overdueCopies = await ctx.db
      .query("copies")
      .withIndex("by_status_deadline", (q) =>
        q.eq("status", "checked_out").lt("returnDeadline", now),
      )
      .collect();

    // Group overdue copies by holder to batch-fetch and apply cumulative penalties
    const penaltyByHolder = new Map<typeof overdueCopies[0]["currentHolderId"], number>();
    for (const copy of overdueCopies) {
      if (!copy.currentHolderId) continue;
      penaltyByHolder.set(
        copy.currentHolderId,
        (penaltyByHolder.get(copy.currentHolderId) ?? 0) + REPUTATION.OVERDUE_DAILY,
      );
    }

    const holderIds = [...penaltyByHolder.keys()];
    const holders = await Promise.all(holderIds.map((id) => ctx.db.get(id!)));

    for (let i = 0; i < holderIds.length; i++) {
      const user = holders[i];
      if (!user) continue;
      await ctx.db.patch(user._id, {
        reputationScore: clampScore(user.reputationScore + penaltyByHolder.get(holderIds[i])!),
      });
    }
  },
});
