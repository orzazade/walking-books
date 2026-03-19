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

    const limit = Math.min(args.limit ?? 20, 100);

    // Get all users this person follows
    const followRows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", user._id))
      .collect();

    if (followRows.length === 0) return [];

    const followedIds = new Set(followRows.map((f) => f.followingId));

    // Cache for users, books, copies, and locations to avoid redundant lookups.
    // Use has() checks so null results (deleted entities) are also cached,
    // preventing repeated DB queries for the same missing entity.
    const userCache = new Map<string, Doc<"users"> | null>();
    const bookCache = new Map<string, Doc<"books"> | null>();
    const copyCache = new Map<string, Doc<"copies"> | null>();
    const locationCache = new Map<string, Doc<"partnerLocations"> | null>();

    async function getUser(id: Id<"users">) {
      if (userCache.has(id)) return userCache.get(id) ?? null;
      const u = await ctx.db.get(id);
      userCache.set(id, u);
      return u;
    }

    async function getBook(id: Id<"books">) {
      if (bookCache.has(id)) return bookCache.get(id) ?? null;
      const b = await ctx.db.get(id);
      bookCache.set(id, b);
      return b;
    }

    async function getCopy(id: Id<"copies">) {
      if (copyCache.has(id)) return copyCache.get(id) ?? null;
      const c = await ctx.db.get(id);
      copyCache.set(id, c);
      return c;
    }

    async function getLocation(id: Id<"partnerLocations">) {
      if (locationCache.has(id)) return locationCache.get(id) ?? null;
      const l = await ctx.db.get(id);
      locationCache.set(id, l);
      return l;
    }

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
        const book = await getBook(copy.bookId);
        const followedUser = await getUser(followedId);
        if (!book || !followedUser) continue;

        const pickupLocation = await getLocation(entry.pickupLocationId);

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
