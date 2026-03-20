import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { createNotification } from "./notifications";

/**
 * Notify users who wishlisted a book that a copy is now available.
 * Skips the acting user (the one who returned/shared the copy).
 */
export async function notifyWishlisters(
  ctx: MutationCtx,
  args: {
    bookId: Id<"books">;
    copyId: Id<"copies">;
    locationId?: Id<"partnerLocations">;
    actingUserId: Id<"users">;
  },
): Promise<number> {
  const wishlistEntries = await ctx.db
    .query("wishlist")
    .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
    .collect();

  if (wishlistEntries.length === 0) return 0;

  const book = await ctx.db.get(args.bookId);
  const bookTitle = book?.title ?? "a book";

  const location = args.locationId
    ? await ctx.db.get(args.locationId)
    : null;
  const locationName = location?.name;

  const message = locationName
    ? `"${bookTitle}" is now available at ${locationName}.`
    : `"${bookTitle}" is now available.`;

  let notified = 0;
  await Promise.all(
    wishlistEntries
      .filter((entry) => entry.userId !== args.actingUserId)
      .map(async (entry) => {
        await createNotification(ctx, {
          userId: entry.userId,
          type: "wishlist_available",
          title: "A wishlisted book is available!",
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
