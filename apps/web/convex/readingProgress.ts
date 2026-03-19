import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";
import { readingProgressStatusValidator } from "./lib/validators";

/** Log or update reading progress for a copy the user is currently holding. */
export const update = mutation({
  args: {
    copyId: v.id("copies"),
    currentPage: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    if (!Number.isInteger(args.currentPage) || args.currentPage < 0)
      throw new Error("Current page must be a non-negative integer");

    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");
    if (copy.currentHolderId !== user._id)
      throw new Error("You are not the current holder of this copy");

    const book = await ctx.db.get(copy.bookId);
    if (!book) throw new Error("Book not found");

    if (args.currentPage > book.pageCount)
      throw new Error(
        `Current page cannot exceed total pages (${book.pageCount})`,
      );

    const now = Date.now();

    const existing = await ctx.db
      .query("readingProgress")
      .withIndex("by_user_copy", (q) =>
        q.eq("userId", user._id).eq("copyId", args.copyId),
      )
      .first();

    const isFinished = args.currentPage === book.pageCount;

    if (existing) {
      if (existing.status !== "reading")
        throw new Error("Cannot update a reading that is " + existing.status);
      await ctx.db.patch(existing._id, {
        currentPage: args.currentPage,
        lastUpdatedAt: now,
        status: isFinished ? "finished" : "reading",
        finishedAt: isFinished ? now : existing.finishedAt,
      });
    } else {
      await ctx.db.insert("readingProgress", {
        userId: user._id,
        copyId: args.copyId,
        bookId: copy.bookId,
        currentPage: args.currentPage,
        totalPages: book.pageCount,
        status: isFinished ? "finished" : "reading",
        startedAt: now,
        lastUpdatedAt: now,
        finishedAt: isFinished ? now : undefined,
      });
    }

    return { success: true };
  },
});

/** Mark a reading as abandoned (stopped reading before finishing). */
export const abandon = mutation({
  args: {
    copyId: v.id("copies"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const existing = await ctx.db
      .query("readingProgress")
      .withIndex("by_user_copy", (q) =>
        q.eq("userId", user._id).eq("copyId", args.copyId),
      )
      .first();

    if (!existing) throw new Error("No reading progress found for this copy");
    if (existing.status !== "reading")
      throw new Error("Can only abandon an active reading");

    await ctx.db.patch(existing._id, {
      status: "abandoned",
      lastUpdatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Get all books the current user is actively reading, with book details and completion %. */
export const currentlyReading = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const entries = await ctx.db
      .query("readingProgress")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "reading"),
      )
      .collect();

    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const [book, copy] = await Promise.all([
          ctx.db.get(entry.bookId),
          ctx.db.get(entry.copyId),
        ]);
        if (!book) return null;

        const percentComplete =
          entry.totalPages > 0
            ? Math.round((entry.currentPage / entry.totalPages) * 100)
            : 0;

        return {
          ...entry,
          bookTitle: book.title,
          bookAuthor: book.author,
          coverImage: book.coverImage,
          percentComplete,
          pagesRemaining: entry.totalPages - entry.currentPage,
          hasReturnDeadline: copy?.returnDeadline ?? null,
        };
      }),
    );

    return enriched.filter((e) => e !== null);
  },
});

/** Get reading progress for a specific copy (for the current user). */
export const forCopy = query({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("readingProgress")
      .withIndex("by_user_copy", (q) =>
        q.eq("userId", user._id).eq("copyId", args.copyId),
      )
      .first();
  },
});

/** Get all reading progress entries for the current user (all statuses). */
export const myReadings = query({
  args: {
    status: v.optional(readingProgressStatusValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    let entries;
    if (args.status) {
      entries = await ctx.db
        .query("readingProgress")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!),
        )
        .collect();
    } else {
      entries = await ctx.db
        .query("readingProgress")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
    }

    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const book = await ctx.db.get(entry.bookId);
        if (!book) return null;

        const percentComplete =
          entry.totalPages > 0
            ? Math.round((entry.currentPage / entry.totalPages) * 100)
            : 0;

        return {
          ...entry,
          bookTitle: book.title,
          bookAuthor: book.author,
          coverImage: book.coverImage,
          percentComplete,
        };
      }),
    );

    return enriched.filter((e) => e !== null);
  },
});
