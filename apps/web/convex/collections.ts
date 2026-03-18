import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

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

    const id = await ctx.db.insert("collections", {
      userId: user._id,
      name: trimmed,
      description: args.description?.trim() || undefined,
      isPublic: args.isPublic,
      createdAt: Date.now(),
    });
    return { _id: id };
  },
});

export const remove = mutation({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) throw new Error("Collection not found");
    if (collection.userId !== user._id) throw new Error("Not authorized");

    // Delete all items in the collection
    const items = await ctx.db
      .query("collectionItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.collectionId);
  },
});

export const addBook = mutation({
  args: { collectionId: v.id("collections"), bookId: v.id("books") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) throw new Error("Collection not found");
    if (collection.userId !== user._id) throw new Error("Not authorized");

    const book = await ctx.db.get(args.bookId);
    if (!book) throw new Error("Book not found");

    // Check if already in collection
    const existing = await ctx.db
      .query("collectionItems")
      .withIndex("by_collection_book", (q) =>
        q.eq("collectionId", args.collectionId).eq("bookId", args.bookId),
      )
      .unique();
    if (existing) throw new Error("Book already in collection");

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
    const user = await requireCurrentUser(ctx);
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) throw new Error("Collection not found");
    if (collection.userId !== user._id) throw new Error("Not authorized");

    const existing = await ctx.db
      .query("collectionItems")
      .withIndex("by_collection_book", (q) =>
        q.eq("collectionId", args.collectionId).eq("bookId", args.bookId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
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

    const books = await Promise.all(
      items.map(async (item) => {
        const book = await ctx.db.get(item.bookId);
        if (!book) return null;
        return { ...item, book };
      }),
    );

    const owner = await ctx.db.get(collection.userId);

    return {
      ...collection,
      ownerName: owner?.name ?? "Unknown",
      books: books
        .filter((b) => b !== null)
        .sort((a, b) => b.addedAt - a.addedAt),
    };
  },
});
