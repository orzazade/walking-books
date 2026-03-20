import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

export const isFavorited = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return false;
    const entry = await ctx.db
      .query("favoriteLocations")
      .withIndex("by_user_location", (q) =>
        q.eq("userId", user._id).eq("locationId", args.locationId),
      )
      .unique();
    return !!entry;
  },
});

export const toggle = mutation({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    const [user, location] = await Promise.all([
      requireCurrentUser(ctx),
      ctx.db.get(args.locationId),
    ]);
    if (!location) throw new Error("Location not found");
    const existing = await ctx.db
      .query("favoriteLocations")
      .withIndex("by_user_location", (q) =>
        q.eq("userId", user._id).eq("locationId", args.locationId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { favorited: false };
    }
    await ctx.db.insert("favoriteLocations", {
      userId: user._id,
      locationId: args.locationId,
      favoritedAt: Date.now(),
    });
    return { favorited: true };
  },
});

export const newArrivals = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const entries = await ctx.db
      .query("favoriteLocations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (entries.length === 0) return [];

    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const arrivals: Array<{
      copyId: string;
      bookId: string;
      title: string;
      author: string;
      coverImage: string;
      locationId: string;
      locationName: string;
      addedAt: number;
      condition: string;
    }> = [];

    await Promise.all(
      entries.map(async (entry) => {
        const location = await ctx.db.get(entry.locationId);
        if (!location) return;
        const copies = await ctx.db
          .query("copies")
          .withIndex("by_location", (q) =>
            q.eq("currentLocationId", location._id).eq("status", "available"),
          )
          .collect();
        const recent = copies.filter((c) => c._creationTime >= fourteenDaysAgo);
        const books = await Promise.all(
          recent.map((c) => ctx.db.get(c.bookId)),
        );
        for (let i = 0; i < recent.length; i++) {
          const book = books[i];
          if (!book) continue;
          arrivals.push({
            copyId: recent[i]._id,
            bookId: book._id,
            title: book.title,
            author: book.author,
            coverImage: book.coverImage,
            locationId: location._id,
            locationName: location.name,
            addedAt: recent[i]._creationTime,
            condition: recent[i].condition,
          });
        }
      }),
    );

    return arrivals
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, 10);
  },
});

export const myFavorites = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const entries = await ctx.db
      .query("favoriteLocations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const results = await Promise.all(
      entries.map(async (entry) => {
        const location = await ctx.db.get(entry.locationId);
        if (!location) return null;
        const copies = await ctx.db
          .query("copies")
          .withIndex("by_location", (q) =>
            q.eq("currentLocationId", location._id).eq("status", "available"),
          )
          .collect();
        return {
          _id: entry._id,
          locationId: location._id,
          name: location.name,
          address: location.address,
          availableBooks: copies.length,
          favoritedAt: entry.favoritedAt,
        };
      }),
    );
    return results
      .filter((r) => r !== null)
      .sort((a, b) => b.favoritedAt - a.favoritedAt);
  },
});
