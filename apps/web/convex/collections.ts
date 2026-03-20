import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { type Id } from "./_generated/dataModel";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

async function requireCollectionOwner(ctx: MutationCtx, collectionId: Id<"collections">) {
  const [user, collection] = await Promise.all([
    requireCurrentUser(ctx),
    ctx.db.get(collectionId),
  ]);
  if (!collection) throw new Error("Collection not found");
  if (collection.userId !== user._id) throw new Error("Not authorized");
  return collection;
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const trimmed = args.name.trim();
    if (trimmed.length === 0) throw new Error("Collection name is required");
    if (trimmed.length > 100)
      throw new Error("Collection name must be 100 characters or less");

    const trimmedDesc = args.description?.trim() || undefined;
    if (trimmedDesc && trimmedDesc.length > 500)
      throw new Error("Collection description must be 500 characters or less");

    const MAX_COLLECTIONS = 50;
    const userCollections = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (userCollections.length >= MAX_COLLECTIONS)
      throw new Error(`Maximum ${MAX_COLLECTIONS} collections allowed`);

    const id = await ctx.db.insert("collections", {
      userId: user._id,
      name: trimmed,
      description: trimmedDesc,
      isPublic: args.isPublic,
      createdAt: Date.now(),
    });
    return { _id: id };
  },
});

export const remove = mutation({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    await requireCollectionOwner(ctx, args.collectionId);

    // Delete all items in the collection
    const items = await ctx.db
      .query("collectionItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .collect();
    await Promise.all(items.map((item) => ctx.db.delete(item._id)));
    await ctx.db.delete(args.collectionId);
  },
});

export const addBook = mutation({
  args: { collectionId: v.id("collections"), bookId: v.id("books") },
  handler: async (ctx, args) => {
    await requireCollectionOwner(ctx, args.collectionId);

    const [book, existing] = await Promise.all([
      ctx.db.get(args.bookId),
      ctx.db
        .query("collectionItems")
        .withIndex("by_collection_book", (q) =>
          q.eq("collectionId", args.collectionId).eq("bookId", args.bookId),
        )
        .unique(),
    ]);
    if (!book) throw new Error("Book not found");
    if (existing) throw new Error("Book already in collection");

    // Per-collection limit on items
    const MAX_ITEMS_PER_COLLECTION = 500;
    const itemCount = await ctx.db
      .query("collectionItems")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect()
      .then((r) => r.length);
    if (itemCount >= MAX_ITEMS_PER_COLLECTION)
      throw new Error(`Maximum ${MAX_ITEMS_PER_COLLECTION} books per collection`);

    const id = await ctx.db.insert("collectionItems", {
      collectionId: args.collectionId,
      bookId: args.bookId,
      addedAt: Date.now(),
    });
    return { _id: id };
  },
});

export const removeBook = mutation({
  args: { collectionId: v.id("collections"), bookId: v.id("books") },
  handler: async (ctx, args) => {
    await requireCollectionOwner(ctx, args.collectionId);

    const existing = await ctx.db
      .query("collectionItems")
      .withIndex("by_collection_book", (q) =>
        q.eq("collectionId", args.collectionId).eq("bookId", args.bookId),
      )
      .unique();
    if (!existing) throw new Error("Book not in collection");
    await ctx.db.delete(existing._id);
  },
});

export const myCollections = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return Promise.all(
      collections.map(async (c) => {
        const items = await ctx.db
          .query("collectionItems")
          .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
          .collect();
        return { ...c, bookCount: items.length };
      }),
    );
  },
});

export const containingBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const results = await Promise.all(
      collections.map(async (c) => {
        const item = await ctx.db
          .query("collectionItems")
          .withIndex("by_collection_book", (q) =>
            q.eq("collectionId", c._id).eq("bookId", args.bookId),
          )
          .unique();
        return { _id: c._id, name: c.name, containsBook: item !== null };
      }),
    );

    return results;
  },
});

export const publicCollections = query({
  handler: async (ctx) => {
    const publicOnes = await ctx.db
      .query("collections")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .order("desc")
      .take(20);

    return Promise.all(
      publicOnes.map(async (c) => {
        const [items, owner, followers] = await Promise.all([
          ctx.db
            .query("collectionItems")
            .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
            .collect(),
          ctx.db.get(c.userId),
          ctx.db
            .query("collectionFollows")
            .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
            .collect(),
        ]);
        return {
          _id: c._id,
          name: c.name,
          description: c.description,
          bookCount: items.length,
          followerCount: followers.length,
          createdAt: c.createdAt,
          ownerName: owner?.name ?? "Unknown",
          ownerId: c.userId,
        };
      }),
    );
  },
});

/**
 * Public collections for a given user — shown on their profile page.
 */
export const byUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const publicOnes = collections.filter((c) => c.isPublic);
    if (publicOnes.length === 0) return [];

    return Promise.all(
      publicOnes.map(async (c) => {
        const [items, followers] = await Promise.all([
          ctx.db
            .query("collectionItems")
            .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
            .collect(),
          ctx.db
            .query("collectionFollows")
            .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
            .collect(),
        ]);
        return {
          _id: c._id,
          name: c.name,
          description: c.description,
          bookCount: items.length,
          followerCount: followers.length,
        };
      }),
    );
  },
});

export const follow = mutation({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) throw new Error("Collection not found");
    if (!collection.isPublic) throw new Error("Cannot follow a private collection");
    if (collection.userId === user._id) throw new Error("Cannot follow your own collection");

    const existing = await ctx.db
      .query("collectionFollows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", user._id).eq("collectionId", args.collectionId),
      )
      .unique();
    if (existing) throw new Error("Already following this collection");

    const MAX_COLLECTION_FOLLOWS = 200;
    const followCount = (
      await ctx.db
        .query("collectionFollows")
        .withIndex("by_follower", (q) => q.eq("followerId", user._id))
        .collect()
    ).length;
    if (followCount >= MAX_COLLECTION_FOLLOWS)
      throw new Error(`Maximum ${MAX_COLLECTION_FOLLOWS} collection follows allowed`);

    await ctx.db.insert("collectionFollows", {
      followerId: user._id,
      collectionId: args.collectionId,
      followedAt: Date.now(),
    });
  },
});

export const unfollow = mutation({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("collectionFollows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", user._id).eq("collectionId", args.collectionId),
      )
      .unique();
    if (!existing) throw new Error("Not following this collection");
    await ctx.db.delete(existing._id);
  },
});

export const isFollowing = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return false;
    const existing = await ctx.db
      .query("collectionFollows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", user._id).eq("collectionId", args.collectionId),
      )
      .unique();
    return existing !== null;
  },
});

export const followerCount = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const followers = await ctx.db
      .query("collectionFollows")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .collect();
    return followers.length;
  },
});

export const followedCollections = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const follows = await ctx.db
      .query("collectionFollows")
      .withIndex("by_follower", (q) => q.eq("followerId", user._id))
      .collect();

    const results = await Promise.all(
      follows.map(async (f) => {
        const collection = await ctx.db.get(f.collectionId);
        if (!collection || !collection.isPublic) return null;
        const [items, owner] = await Promise.all([
          ctx.db
            .query("collectionItems")
            .withIndex("by_collection", (q) => q.eq("collectionId", f.collectionId))
            .collect(),
          ctx.db.get(collection.userId),
        ]);
        return {
          _id: collection._id,
          name: collection.name,
          description: collection.description,
          bookCount: items.length,
          createdAt: collection.createdAt,
          ownerName: owner?.name ?? "Unknown",
          ownerId: collection.userId,
          followedAt: f.followedAt,
        };
      }),
    );

    return results
      .filter((r) => r !== null)
      .sort((a, b) => b.followedAt - a.followedAt);
  },
});

export const getCollection = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) return null;

    // Private collections are only visible to the owner
    if (!collection.isPublic) {
      const user = await getCurrentUser(ctx);
      if (!user || user._id !== collection.userId) return null;
    }

    const items = await ctx.db
      .query("collectionItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .collect();

    const [books, owner] = await Promise.all([
      Promise.all(
        items.map(async (item) => {
          const book = await ctx.db.get(item.bookId);
          if (!book) return null;
          return { ...item, book };
        }),
      ),
      ctx.db.get(collection.userId),
    ]);

    return {
      ...collection,
      ownerName: owner?.name ?? "Unknown",
      books: books
        .filter((b) => b !== null)
        .sort((a, b) => b.addedAt - a.addedAt),
    };
  },
});
