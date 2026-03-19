import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";
import { createEntityCache } from "./lib/entityCache";
import type { Id } from "./_generated/dataModel";

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

    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));

    // Get all users this person follows
    const followRows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", user._id))
      .collect();

    if (followRows.length === 0) return [];

    const followedIds = new Set(followRows.map((f) => f.followingId));

    const { getUser, getBook, getCopy, getLocation } = createEntityCache(ctx);

    const followedArray = [...followedIds];

    // Batch-fetch all journey entries and reviews across followed users in parallel
    const [journeyArrays, reviewArrays] = await Promise.all([
      Promise.all(
        followedArray.map((id) =>
          ctx.db
            .query("journeyEntries")
            .withIndex("by_reader", (q) => q.eq("readerId", id))
            .order("desc")
            .take(limit),
        ),
      ),
      Promise.all(
        followedArray.map((id) =>
          ctx.db
            .query("reviews")
            .withIndex("by_user", (q) => q.eq("userId", id))
            .order("desc")
            .take(limit),
        ),
      ),
    ]);

    const items: FeedItem[] = [];

    // Process journey entries (pickups & returns)
    for (let i = 0; i < followedArray.length; i++) {
      const followedId = followedArray[i];
      for (const entry of journeyArrays[i]) {
        const copy = await getCopy(entry.copyId);
        if (!copy) continue;
        const [book, followedUser, pickupLocation] = await Promise.all([
          getBook(copy.bookId),
          getUser(followedId),
          getLocation(entry.pickupLocationId),
        ]);
        if (!book || !followedUser) continue;

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
            ? await getLocation(entry.dropoffLocationId)
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

    // Process reviews
    for (let i = 0; i < followedArray.length; i++) {
      const followedId = followedArray[i];
      for (const review of reviewArrays[i]) {
        const [book, reviewer] = await Promise.all([
          getBook(review.bookId),
          getUser(followedId),
        ]);
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
