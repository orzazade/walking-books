import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { REPUTATION, clampScore, getUserRestrictions } from "./lib/reputation";
import { HOUR_MS, RESERVATION_EXPIRY_HOURS } from "./lib/lending";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";
import { notifyNextWaiter } from "./lib/waitlist";
import { createNotification } from "./lib/notifications";

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

/** Active reservations enriched with book title, cover, author, and location name/address. */
export const myActive = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_user", (q) =>
        q.eq("userId", user._id).eq("status", "active"),
      )
      .collect();

    if (reservations.length === 0) return [];

    const enriched = await Promise.all(
      reservations.map(async (res) => {
        const [copy, location] = await Promise.all([
          ctx.db.get(res.copyId),
          ctx.db.get(res.locationId),
        ]);
        const book = copy ? await ctx.db.get(copy.bookId) : null;

        return {
          ...res,
          bookTitle: book?.title ?? "Unknown book",
          bookAuthor: book?.author ?? "Unknown author",
          coverImage: book?.coverImage ?? null,
          bookId: copy?.bookId ?? null,
          locationName: location?.name ?? "Unknown location",
          locationAddress: location?.address ?? "",
        };
      }),
    );

    return enriched;
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

    // Validate location exists
    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");

    // Check copy is available at the specified location
    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");
    if (copy.status !== "available")
      throw new Error("Copy is not available for reservation");
    if (copy.currentLocationId !== args.locationId)
      throw new Error("Copy is not at the specified location");
    if (copy.originalSharerId === user._id)
      throw new Error("Cannot reserve your own book — use recall instead");

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

    // Notify user that reservation is confirmed
    const book = await ctx.db.get(copy.bookId);
    const bookTitle = book?.title ?? "a book";
    await createNotification(ctx, {
      userId: user._id,
      type: "reservation_confirmed",
      title: "Reservation confirmed",
      message: `Your reservation for "${bookTitle}" at ${location.name} expires in ${RESERVATION_EXPIRY_HOURS} hours.`,
      relatedBookId: copy.bookId,
      relatedCopyId: args.copyId,
      relatedLocationId: args.locationId,
    });

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

    // Release copy and notify waitlist
    const copy = await ctx.db.get(reservation.copyId);
    if (copy && copy.status === "reserved") {
      await ctx.db.patch(reservation.copyId, { status: "available" });
      await notifyNextWaiter(ctx, copy.bookId, reservation.copyId, Date.now());
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

    // Batch-fetch all copies for stale reservations
    const copies = await Promise.all(
      staleReservations.map((r) => ctx.db.get(r.copyId)),
    );

    // Expire all stale reservations and release their copies in parallel
    const releasedCopies: { bookId: Id<"books">; copyId: Id<"copies"> }[] = [];
    await Promise.all(
      staleReservations.flatMap((reservation, i) => {
        const ops = [ctx.db.patch(reservation._id, { status: "expired" as const })];
        const copy = copies[i];
        if (copy && copy.status === "reserved") {
          ops.push(ctx.db.patch(reservation.copyId, { status: "available" as const }));
          releasedCopies.push({ bookId: copy.bookId, copyId: reservation.copyId });
        }
        return ops;
      }),
    );

    // Notify waitlist for each released copy
    await Promise.all(
      releasedCopies.map(({ bookId, copyId }) => notifyNextWaiter(ctx, bookId, copyId, now)),
    );

    // Notify users that their reservations expired — reuse already-fetched copies
    const bookIds = new Set<Id<"books">>();
    for (const copy of copies) {
      if (copy) bookIds.add(copy.bookId);
    }
    const bookDocs = await Promise.all([...bookIds].map((id) => ctx.db.get(id)));
    const bookMap = new Map(
      bookDocs.filter((b) => b !== null).map((b) => [b._id, b]),
    );

    await Promise.all(
      staleReservations.map((reservation, i) => {
        const copy = copies[i];
        if (!copy) return;
        const book = bookMap.get(copy.bookId);
        const bookTitle = book?.title ?? "a book";
        return createNotification(ctx, {
          userId: reservation.userId,
          type: "reservation_expired",
          title: "Reservation expired",
          message: `Your reservation for "${bookTitle}" has expired. You can reserve again or join the waitlist.`,
          relatedBookId: copy.bookId,
          relatedCopyId: reservation.copyId,
        });
      }),
    );

    // Group penalties by user and apply cumulative no-show penalties
    const penaltyByUser = new Map<Id<"users">, number>();
    for (const reservation of staleReservations) {
      penaltyByUser.set(
        reservation.userId,
        (penaltyByUser.get(reservation.userId) ?? 0) + REPUTATION.NO_SHOW,
      );
    }

    await Promise.all(
      [...penaltyByUser.entries()].map(async ([userId, penalty]) => {
        const user = await ctx.db.get(userId);
        if (!user) return;
        return ctx.db.patch(user._id, {
          reputationScore: clampScore(user.reputationScore + penalty),
        });
      }),
    );
  },
});
