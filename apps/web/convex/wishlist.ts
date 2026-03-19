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
    const [user, book] = await Promise.all([
      requireCurrentUser(ctx),
      ctx.db.get(args.bookId),
    ]);
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

export const availableNow = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const entries = await ctx.db
      .query("wishlist")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const results = await Promise.all(
      entries.map(async (entry) => {
        const book = await ctx.db.get(entry.bookId);
        if (!book) return null;

        // Find available copies with their locations
        const copies = await ctx.db
          .query("copies")
          .withIndex("by_book", (q) => q.eq("bookId", entry.bookId))
          .collect();

        const availableCopies = copies.filter((c) => c.status === "available");
        if (availableCopies.length === 0) return null;

        // Get unique location names for available copies
        const locationIds = [
          ...new Set(
            availableCopies
              .map((c) => c.currentLocationId)
              .filter((id): id is NonNullable<typeof id> => id !== undefined),
          ),
        ];
        const locations = await Promise.all(
          locationIds.map(async (id) => {
            const loc = await ctx.db.get(id);
            return loc ? { _id: loc._id, name: loc.name, address: loc.address } : null;
          }),
        );

        return {
          bookId: book._id,
          title: book.title,
          author: book.author,
          coverImage: book.coverImage,
          avgRating: book.avgRating,
          availableCount: availableCopies.length,
          locations: locations.filter((l) => l !== null),
          // Return the first available copy ID for quick reservation
          firstAvailableCopyId: availableCopies[0]._id,
          firstLocationId: availableCopies[0].currentLocationId,
        };
      }),
    );

    return results.filter((r) => r !== null);
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
