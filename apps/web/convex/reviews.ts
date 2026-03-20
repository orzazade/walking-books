import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import { recalcAvgRating } from "./lib/ratings";

export const byBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reviews")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
  },
});

export const byUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const bookIds = [...new Set(reviews.map((r) => r.bookId))];
    const books = await Promise.all(bookIds.map((id) => ctx.db.get(id)));
    const bookMap = new Map(
      books.filter(Boolean).map((b) => [b!._id, b!]),
    );

    return reviews
      .map((r) => {
        const book = bookMap.get(r.bookId);
        if (!book) return null;
        return {
          _id: r._id,
          _creationTime: r._creationTime,
          bookId: r.bookId,
          rating: r.rating,
          text: r.text,
          bookTitle: book.title,
          bookAuthor: book.author,
          bookCoverImage: book.coverImage,
        };
      })
      .filter(Boolean);
  },
});

export const create = mutation({
  args: {
    bookId: v.id("books"),
    rating: v.number(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    if (args.rating < 1 || args.rating > 5 || !Number.isInteger(args.rating))
      throw new Error("Rating must be an integer between 1 and 5");
    const trimmedText = args.text.trim();
    if (trimmedText.length === 0)
      throw new Error("Review text is required");
    if (trimmedText.length > 5000)
      throw new Error("Review text must be 5000 characters or less");

    // Upsert: one review per user per book
    const [book, existing] = await Promise.all([
      ctx.db.get(args.bookId),
      ctx.db
        .query("reviews")
        .withIndex("by_user_book", (q) =>
          q.eq("userId", user._id).eq("bookId", args.bookId),
        )
        .unique(),
    ]);
    if (!book) throw new Error("Book not found");

    if (existing) {
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        text: trimmedText,
      });

      // Recalculate book average with updated rating
      const updated = recalcAvgRating(
        book.avgRating, book.reviewCount, args.rating, existing.rating,
      );
      await ctx.db.patch(args.bookId, { avgRating: updated.avgRating });

      return existing._id;
    }

    const reviewId = await ctx.db.insert("reviews", {
      bookId: args.bookId,
      userId: user._id,
      rating: args.rating,
      text: trimmedText,
    });

    // Update book aggregate rating
    const { avgRating, reviewCount } = recalcAvgRating(
      book.avgRating, book.reviewCount, args.rating,
    );
    await ctx.db.patch(args.bookId, { avgRating, reviewCount });

    return reviewId;
  },
});
