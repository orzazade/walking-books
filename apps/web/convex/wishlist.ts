import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

export const isWishlisted = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return false;
    const entry = await ctx.db
      .query("wishlist")
      .withIndex("by_user_book", (q) =>
        q.eq("userId", user._id).eq("bookId", args.bookId),
      )
      .unique();
    return !!entry;
  },
});

export const toggle = mutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const book = await ctx.db.get(args.bookId);
    if (!book) throw new Error("Book not found");
    const existing = await ctx.db
      .query("wishlist")
      .withIndex("by_user_book", (q) =>
        q.eq("userId", user._id).eq("bookId", args.bookId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { wishlisted: false };
    }
    await ctx.db.insert("wishlist", {
      userId: user._id,
      bookId: args.bookId,
      addedAt: Date.now(),
    });
    return { wishlisted: true };
  },
});

export const myWishlist = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const entries = await ctx.db
      .query("wishlist")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const booksWithMeta = await Promise.all(
      entries.map(async (entry) => {
        const book = await ctx.db.get(entry.bookId);
        if (!book) return null;
        const availableCount = (
          await ctx.db
            .query("copies")
            .withIndex("by_book", (q) => q.eq("bookId", entry.bookId))
            .collect()
        ).filter((c) => c.status === "available").length;
        return {
          ...entry,
          book,
          availableCount,
        };
      }),
    );
    return booksWithMeta
      .filter((b) => b !== null)
      .sort((a, b) => b.addedAt - a.addedAt);
  },
});
