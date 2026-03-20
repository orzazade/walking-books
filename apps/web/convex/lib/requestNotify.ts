import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { createNotification } from "./notifications";

/**
 * Notify users who have open book requests matching a newly shared book.
 * Called from books.register when a new copy is added to the platform.
 * Skips the acting user (the sharer themselves).
 */
export async function notifyBookRequesters(
  ctx: MutationCtx,
  args: {
    bookTitle: string;
    bookId: Id<"books">;
    copyId: Id<"copies">;
    locationId?: Id<"partnerLocations">;
    actingUserId: Id<"users">;
  },
): Promise<number> {
  const openRequests = await ctx.db
    .query("bookRequests")
    .withIndex("by_status", (q) => q.eq("status", "open"))
    .collect();

  if (openRequests.length === 0) return 0;

  const normalizedTitle = args.bookTitle.toLowerCase().trim();

  const matching = openRequests.filter(
    (r) =>
      r.userId !== args.actingUserId &&
      r.title.toLowerCase().trim() === normalizedTitle,
  );

  if (matching.length === 0) return 0;

  const location = args.locationId
    ? await ctx.db.get(args.locationId)
    : null;
  const locationName = location?.name;

  const message = locationName
    ? `"${args.bookTitle}" was just shared at ${locationName}. Reserve it before it's gone!`
    : `"${args.bookTitle}" was just shared on Walking Books. Reserve it before it's gone!`;

  let notified = 0;
  await Promise.all(
    matching.map(async (request) => {
      await createNotification(ctx, {
        userId: request.userId,
        type: "book_request_fulfilled",
        title: "A book you requested is now available!",
        message,
        relatedBookId: args.bookId,
        relatedCopyId: args.copyId,
        relatedLocationId: args.locationId,
      });
      notified++;
    }),
  );

  return notified;
}

/**
 * Notify the requester that someone fulfilled their book request.
 * Called from bookRequests.fulfill.
 */
export async function notifyRequesterFulfilled(
  ctx: MutationCtx,
  args: {
    requesterId: Id<"users">;
    bookTitle: string;
    fulfillerName: string;
  },
): Promise<void> {
  await createNotification(ctx, {
    userId: args.requesterId,
    type: "book_request_fulfilled",
    title: "Your book request was fulfilled!",
    message: `${args.fulfillerName} responded to your request for "${args.bookTitle}". Check the catalog to find and reserve it.`,
  });
}
