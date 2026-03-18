import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";
import { Doc, Id } from "./_generated/dataModel";

type FeedItem = {
  type: "pickup" | "return" | "review";
  timestamp: number;
  user: { _id: Id<"users">; name: string; avatarUrl?: string };
  book: { _id: Id<"books">; title: string; author: string; coverImage: string };
  detail: { locationName?: string; rating?: number; reviewText?: string };
};

export const feed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<FeedItem[]> => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const limit = args.limit ?? 20;

    // Get all users this person follows
    const followRows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", user._id))
      .collect();

    if (followRows.length === 0) return [];

    const followedIds = new Set(followRows.map((f) => f.followingId));

    // Cache for users and books to avoid redundant lookups
    const userCache = new Map<string, Doc<"users">>();
    const bookCache = new Map<string, Doc<"books">>();

    async function getUser(id: Id<"users">) {
      const cached = userCache.get(id);
      if (cached) return cached;
      const u = await ctx.db.get(id);
      if (u) userCache.set(id, u);
      return u;
    }

    async function getBook(id: Id<"books">) {
      const cached = bookCache.get(id);
      if (cached) return cached;
      const b = await ctx.db.get(id);
      if (b) bookCache.set(id, b);
      return b;
    }

    const items: FeedItem[] = [];

    // Collect journey entries (pickups & returns) from followed users
    for (const followedId of followedIds) {
      const entries = await ctx.db
        .query("journeyEntries")
        .withIndex("by_reader", (q) => q.eq("readerId", followedId))
        .collect();

      for (const entry of entries) {
        const copy = await ctx.db.get(entry.copyId);
        if (!copy) continue;
        const book = await getBook(copy.bookId);
        const followedUser = await getUser(followedId);
        if (!book || !followedUser) continue;

        const pickupLocation = await ctx.db.get(entry.pickupLocationId);

        // Pickup event
        items.push({
          type: "pickup",
          timestamp: entry.pickedUpAt,
          user: {
            _id: followedUser._id,
            name: followedUser.name,
            avatarUrl: followedUser.avatarUrl,
          },
          book: {
            _id: book._id,
            title: book.title,
            author: book.author,
            coverImage: book.coverImage,
          },
          detail: { locationName: pickupLocation?.name },
        });

        // Return event (if returned)
        if (entry.returnedAt) {
          const dropoffLocation = entry.dropoffLocationId
            ? await ctx.db.get(entry.dropoffLocationId)
            : null;
          items.push({
            type: "return",
            timestamp: entry.returnedAt,
            user: {
              _id: followedUser._id,
              name: followedUser.name,
              avatarUrl: followedUser.avatarUrl,
            },
            book: {
              _id: book._id,
              title: book.title,
              author: book.author,
              coverImage: book.coverImage,
            },
            detail: { locationName: dropoffLocation?.name },
          });
        }
      }
    }

    // Collect reviews from followed users via index lookup per user
    for (const followedId of followedIds) {
      const reviews = await ctx.db
        .query("reviews")
        .withIndex("by_user", (q) => q.eq("userId", followedId))
        .collect();

      for (const review of reviews) {
        const book = await getBook(review.bookId);
        const reviewer = await getUser(followedId);
        if (!book || !reviewer) continue;

        items.push({
          type: "review",
          timestamp: review._creationTime,
          user: {
            _id: reviewer._id,
            name: reviewer.name,
            avatarUrl: reviewer.avatarUrl,
          },
          book: {
            _id: book._id,
            title: book.title,
            author: book.author,
            coverImage: book.coverImage,
          },
          detail: { rating: review.rating, reviewText: review.text },
        });
      }
    }

    // Sort by most recent first and limit
    items.sort((a, b) => b.timestamp - a.timestamp);
    return items.slice(0, limit);
  },
});
