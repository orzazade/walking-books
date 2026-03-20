import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";
import { createNotification } from "./lib/notifications";

/** Create a transfer request — reader asks for a copy to be moved to a closer location. */
export const create = mutation({
  args: {
    copyId: v.id("copies"),
    toLocationId: v.id("partnerLocations"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");
    if (copy.status !== "available")
      throw new Error("Only available copies can be transferred");
    if (!copy.currentLocationId)
      throw new Error("Copy is not at a partner location");
    if (copy.currentLocationId === args.toLocationId)
      throw new Error("Copy is already at this location");

    const toLocation = await ctx.db.get(args.toLocationId);
    if (!toLocation) throw new Error("Destination location not found");

    // Check for existing pending request for this copy by this user
    const existing = await ctx.db
      .query("transferRequests")
      .withIndex("by_copy", (q) =>
        q.eq("copyId", args.copyId).eq("status", "pending"),
      )
      .filter((q) => q.eq(q.field("requesterId"), user._id))
      .first();
    if (existing)
      throw new Error("You already have a pending transfer request for this copy");

    if (args.note && args.note.length > 500)
      throw new Error("Note must be 500 characters or less");

    return await ctx.db.insert("transferRequests", {
      copyId: args.copyId,
      bookId: copy.bookId,
      requesterId: user._id,
      fromLocationId: copy.currentLocationId,
      toLocationId: args.toLocationId,
      status: "pending",
      note: args.note,
      createdAt: Date.now(),
    });
  },
});

/** Cancel a pending transfer request (by the requester). */
export const cancel = mutation({
  args: { requestId: v.id("transferRequests") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Transfer request not found");
    if (request.requesterId !== user._id)
      throw new Error("Not authorized");
    if (request.status !== "pending")
      throw new Error("Only pending requests can be cancelled");

    await ctx.db.patch(args.requestId, {
      status: "cancelled",
      resolvedAt: Date.now(),
    });
  },
});

/** Accept a transfer request — partner at the source location approves the move. */
export const accept = mutation({
  args: { requestId: v.id("transferRequests") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Transfer request not found");
    if (request.status !== "pending")
      throw new Error("Only pending requests can be accepted");

    // Verify the user manages the source location
    const fromLocation = await ctx.db.get(request.fromLocationId);
    if (!fromLocation) throw new Error("Source location not found");
    const isManager = fromLocation.managedByUserId === user._id;
    const isStaff = fromLocation.staffUserIds.includes(user._id);
    if (!isManager && !isStaff)
      throw new Error("Only location staff can accept transfer requests");

    // Verify copy is still available at this location
    const copy = await ctx.db.get(request.copyId);
    if (!copy || copy.status !== "available" || copy.currentLocationId !== request.fromLocationId)
      throw new Error("Copy is no longer available at this location");

    // Move the copy to the destination location
    const toLocation = await ctx.db.get(request.toLocationId);
    if (!toLocation) throw new Error("Destination location not found");

    await ctx.db.patch(request.copyId, {
      currentLocationId: request.toLocationId,
    });

    await ctx.db.patch(args.requestId, {
      status: "accepted",
      resolvedAt: Date.now(),
    });

    // Update book counts
    await ctx.db.patch(request.fromLocationId, {
      currentBookCount: Math.max(0, fromLocation.currentBookCount - 1),
    });
    await ctx.db.patch(request.toLocationId, {
      currentBookCount: toLocation.currentBookCount + 1,
    });

    // Notify the requester
    const book = await ctx.db.get(request.bookId);
    await createNotification(ctx, {
      userId: request.requesterId,
      type: "transfer_accepted",
      title: "Transfer request accepted",
      message: `"${book?.title ?? "A book"}" has been transferred to ${toLocation.name}.`,
      relatedBookId: request.bookId,
      relatedCopyId: request.copyId,
      relatedLocationId: request.toLocationId,
    });
  },
});

/** Reject a transfer request — partner at the source location declines. */
export const reject = mutation({
  args: { requestId: v.id("transferRequests") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Transfer request not found");
    if (request.status !== "pending")
      throw new Error("Only pending requests can be rejected");

    const fromLocation = await ctx.db.get(request.fromLocationId);
    if (!fromLocation) throw new Error("Source location not found");
    const isManager = fromLocation.managedByUserId === user._id;
    const isStaff = fromLocation.staffUserIds.includes(user._id);
    if (!isManager && !isStaff)
      throw new Error("Only location staff can reject transfer requests");

    await ctx.db.patch(args.requestId, {
      status: "rejected",
      resolvedAt: Date.now(),
    });
  },
});

/** Get the current user's transfer requests. */
export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const requests = await ctx.db
      .query("transferRequests")
      .withIndex("by_requester", (q) => q.eq("requesterId", user._id))
      .collect();

    if (requests.length === 0) return [];

    const enriched = await Promise.all(
      requests.map(async (req) => {
        const [book, fromLoc, toLoc] = await Promise.all([
          ctx.db.get(req.bookId),
          ctx.db.get(req.fromLocationId),
          ctx.db.get(req.toLocationId),
        ]);
        return {
          ...req,
          bookTitle: book?.title ?? "Unknown book",
          bookAuthor: book?.author ?? "Unknown author",
          coverImage: book?.coverImage ?? null,
          fromLocationName: fromLoc?.name ?? "Unknown",
          toLocationName: toLoc?.name ?? "Unknown",
        };
      }),
    );

    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Get pending transfer requests for a location (partner view). */
export const forLocation = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("transferRequests")
      .withIndex("by_from_location", (q) =>
        q.eq("fromLocationId", args.locationId).eq("status", "pending"),
      )
      .collect();

    if (requests.length === 0) return [];

    const enriched = await Promise.all(
      requests.map(async (req) => {
        const [book, requester, toLoc] = await Promise.all([
          ctx.db.get(req.bookId),
          ctx.db.get(req.requesterId),
          ctx.db.get(req.toLocationId),
        ]);
        return {
          ...req,
          bookTitle: book?.title ?? "Unknown book",
          bookAuthor: book?.author ?? "Unknown author",
          coverImage: book?.coverImage ?? null,
          requesterName: requester?.name ?? "Unknown",
          toLocationName: toLoc?.name ?? "Unknown",
        };
      }),
    );

    return enriched.sort((a, b) => a.createdAt - b.createdAt);
  },
});

/** Check if the current user has a pending transfer request for a specific copy. */
export const pendingForCopy = query({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("transferRequests")
      .withIndex("by_copy", (q) =>
        q.eq("copyId", args.copyId).eq("status", "pending"),
      )
      .filter((q) => q.eq(q.field("requesterId"), user._id))
      .first();
  },
});
