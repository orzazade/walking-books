import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

export const save = mutation({
  args: {
    bookId: v.id("books"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const trimmed = args.content.trim();
    if (trimmed.length === 0) throw new Error("Note content is required");
    if (trimmed.length > 10000) throw new Error("Note must be 10000 characters or less");

    const [book, existing] = await Promise.all([
      ctx.db.get(args.bookId),
      ctx.db
        .query("bookNotes")
        .withIndex("by_user_book", (q) =>
          q.eq("userId", user._id).eq("bookId", args.bookId),
        )
        .unique(),
    ]);
    if (!book) throw new Error("Book not found");

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: trimmed,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("bookNotes", {
      userId: user._id,
      bookId: args.bookId,
      content: trimmed,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const existing = await ctx.db
      .query("bookNotes")
      .withIndex("by_user_book", (q) =>
        q.eq("userId", user._id).eq("bookId", args.bookId),
      )
      .unique();
    if (!existing) throw new Error("Note not found");

    await ctx.db.delete(existing._id);
  },
});

export const myNote = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("bookNotes")
      .withIndex("by_user_book", (q) =>
        q.eq("userId", user._id).eq("bookId", args.bookId),
      )
      .unique();
  },
});

export const myNotes = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const notes = await ctx.db
      .query("bookNotes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return Promise.all(
      notes
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (note) => {
          const book = await ctx.db.get(note.bookId);
          return {
            ...note,
            bookTitle: book?.title ?? "Unknown",
            bookAuthor: book?.author ?? "Unknown",
          };
        }),
    );
  },
});
