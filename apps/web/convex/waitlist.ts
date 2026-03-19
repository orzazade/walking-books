import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";
import { notifyNextWaiter } from "./lib/waitlist";

/** Compute a waiter's 1-based FIFO position among all "waiting" entries for a book. */
async function getWaitlistPosition(
  ctx: QueryCtx,
  bookId: Id<"books">,
  entry: { joinedAt: number; _creationTime: number },
): Promise<number> {
  const waiters = await ctx.db
    .query("waitlist")
    .withIndex("by_book_status", (q) =>
      q.eq("bookId", bookId).eq("status", "waiting"),
    )
    .collect();
  return (
    waiters.filter(
      (w) =>
        w.joinedAt < entry.joinedAt ||
        (w.joinedAt === entry.joinedAt && w._creationTime < entry._creationTime),
    ).length + 1
  );
}

export const join = mutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const book = await ctx.db.get(args.bookId);
    if (!book) throw new Error("Book not found");

    // Check not already on waitlist for this book
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_user_book", (q) =>
        q.eq("userId", user._id).eq("bookId", args.bookId),
      )
      .collect();
    const activeEntry = existing.find(
      (e) => e.status === "waiting" || e.status === "notified",
    );
    if (activeEntry) throw new Error("Already on waitlist for this book");

    // Check there are no available copies — waitlist is for unavailable books
    const copies = await ctx.db
      .query("copies")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
    const hasAvailable = copies.some((c) => c.status === "available");
    if (hasAvailable)
      throw new Error("Copies are available — reserve directly instead");

    if (copies.length === 0)
      throw new Error("No copies of this book exist in the system");

    return await ctx.db.insert("waitlist", {
      userId: user._id,
      bookId: args.bookId,
      status: "waiting",
      joinedAt: Date.now(),
    });
  },
});

export const leave = mutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const entries = await ctx.db
      .query("waitlist")
      .withIndex("by_user_book", (q) =>
        q.eq("userId", user._id).eq("bookId", args.bookId),
      )
      .collect();
    const activeEntry = entries.find(
      (e) => e.status === "waiting" || e.status === "notified",
    );
    if (!activeEntry) throw new Error("Not on waitlist for this book");

    await ctx.db.patch(activeEntry._id, { status: "cancelled" });
    return { success: true };
  },
});

export const myWaitlist = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const entries = await ctx.db
      .query("waitlist")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const activeEntries = entries.filter(
      (e) => e.status === "waiting" || e.status === "notified",
    );

    const results = await Promise.all(
      activeEntries.map(async (entry) => {
        const book = await ctx.db.get(entry.bookId);
        if (!book) return null;

        const position = await getWaitlistPosition(ctx, entry.bookId, entry);

        return {
          _id: entry._id,
          bookId: entry.bookId,
          title: book.title,
          author: book.author,
          coverImage: book.coverImage,
          status: entry.status,
          joinedAt: entry.joinedAt,
          notifiedAt: entry.notifiedAt,
          position: entry.status === "waiting" ? position : 0,
        };
      }),
    );

    return results
      .filter((r) => r !== null)
      .sort((a, b) => a.joinedAt - b.joinedAt);
  },
});

export const position = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const entries = await ctx.db
      .query("waitlist")
      .withIndex("by_user_book", (q) =>
        q.eq("userId", user._id).eq("bookId", args.bookId),
      )
      .collect();
    const activeEntry = entries.find(
      (e) => e.status === "waiting" || e.status === "notified",
    );
    if (!activeEntry) return null;

    if (activeEntry.status === "notified") {
      return { position: 0, status: "notified" as const, notifiedAt: activeEntry.notifiedAt };
    }

    const position = await getWaitlistPosition(ctx, args.bookId, activeEntry);

    return { position, status: "waiting" as const, notifiedAt: null };
  },
});

/**
 * Called internally when a copy becomes available (e.g. after return).
 * Notifies the next person on the waitlist for this book.
 */
export const notifyNext = mutation({
  args: { bookId: v.id("books"), copyId: v.id("copies") },
  handler: async (ctx, args) => {
    return await notifyNextWaiter(ctx, args.bookId, args.copyId, Date.now());
  },
});
