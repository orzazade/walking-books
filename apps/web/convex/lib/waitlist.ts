import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { DAY_MS } from "./lending";
import { createNotification } from "./notifications";

/** 24-hour window for a notified user to reserve before the slot moves on. */
const NOTIFICATION_WINDOW_MS = DAY_MS;

/**
 * Expire stale notifications and notify the next waiting user for a book.
 * Returns the notified userId, or null if no one is waiting.
 */
export async function notifyNextWaiter(
  ctx: MutationCtx,
  bookId: Id<"books">,
  copyId: Id<"copies">,
  now: number,
): Promise<Id<"users"> | null> {
  // Expire any stale notifications first (past 24h window)
  const notified = await ctx.db
    .query("waitlist")
    .withIndex("by_book_status", (q) =>
      q.eq("bookId", bookId).eq("status", "notified"),
    )
    .collect();

  for (const entry of notified) {
    if (entry.notifiedAt && now - entry.notifiedAt > NOTIFICATION_WINDOW_MS) {
      await ctx.db.patch(entry._id, { status: "cancelled" });
    }
  }

  // Find the next waiting user (FIFO by joinedAt)
  const nextWaiter = await ctx.db
    .query("waitlist")
    .withIndex("by_book_status", (q) =>
      q.eq("bookId", bookId).eq("status", "waiting"),
    )
    .first();

  if (!nextWaiter) return null;

  await ctx.db.patch(nextWaiter._id, {
    status: "notified",
    notifiedAt: now,
    notifiedCopyId: copyId,
  });

  // Send in-app notification
  const book = await ctx.db.get(bookId);
  const bookTitle = book?.title ?? "a book";
  await createNotification(ctx, {
    userId: nextWaiter.userId,
    type: "waitlist_available",
    title: "A book you wanted is available!",
    message: `"${bookTitle}" is now available. You have 24 hours to reserve it.`,
    relatedBookId: bookId,
    relatedCopyId: copyId,
  });

  return nextWaiter.userId;
}
