import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser } from "./lib/auth";
import { getBookCopyCounts, getBookCopyCountsFor } from "./lib/availability";

export const forMe = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // Fetch all independent data sources in parallel
    const [journeyEntries, checkedOutCopies, copyCounts, allBooks] = await Promise.all([
      ctx.db.query("journeyEntries")
        .withIndex("by_reader", (q) => q.eq("readerId", user._id))
        .collect(),
      ctx.db.query("copies")
        .withIndex("by_holder", (q) => q.eq("currentHolderId", user._id))
        .collect(),
      getBookCopyCounts(ctx),
      ctx.db.query("books").collect(),
    ]);

    // Resolve read copies (depends on journeyEntries)
    const readCopies = await Promise.all(
      journeyEntries.map((e) => ctx.db.get(e.copyId)),
    );
    const readBookIds = new Set<Id<"books">>();
    for (const copy of readCopies) {
      if (copy) readBookIds.add(copy.bookId);
    }
    for (const copy of checkedOutCopies) {
      readBookIds.add(copy.bookId);
    }
    const candidates = allBooks.filter((b) => !readBookIds.has(b._id));

    const genres = new Set(user.favoriteGenres);
    const hasGenres = genres.size > 0;

    // Score each candidate
    const scored = candidates.map((book) => {
      let score = 0;

      // Genre match: +10 per matching genre
      if (hasGenres) {
        for (const cat of book.categories) {
          if (genres.has(cat)) score += 10;
        }
      }

      // Availability bonus: +5 if available right now
      const available = copyCounts.get(book._id)?.availableCopies ?? 0;
      if (available > 0) score += 5;

      // Rating bonus: scale 0-5
      score += book.avgRating;

      // Review count tiebreaker (popular books surface higher)
      score += Math.min(book.reviewCount, 10) * 0.1;

      return { ...book, score, availableCopies: available };
    });

    // Sort by score descending, then by title for stability
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.title.localeCompare(b.title);
    });

    return scored.slice(0, 12).map((b) => ({
      _id: b._id,
      title: b.title,
      author: b.author,
      coverImage: b.coverImage,
      categories: b.categories,
      avgRating: b.avgRating,
      reviewCount: b.reviewCount,
      availableCopies: b.availableCopies,
    }));
  },
});

/**
 * "Readers also enjoyed" — collaborative filtering per book.
 * Finds books commonly read by other readers who also read the given book.
 */
export const forBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    // 1. Fetch book and its copies in parallel
    const [book, copies] = await Promise.all([
      ctx.db.get(args.bookId),
      ctx.db
        .query("copies")
        .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
        .collect(),
    ]);
    if (!book || copies.length === 0) return [];

    const copyIds = new Set(copies.map((c) => c._id));

    // 2. Find readers who completed this book (have returnedAt set)
    const journeyArrays = await Promise.all(
      copies.map((copy) =>
        ctx.db
          .query("journeyEntries")
          .withIndex("by_copy", (q) => q.eq("copyId", copy._id))
          .collect(),
      ),
    );
    const readerIds = new Set<Id<"users">>();
    for (const entries of journeyArrays) {
      for (const entry of entries) {
        if (entry.returnedAt) {
          readerIds.add(entry.readerId);
        }
      }
    }
    if (readerIds.size === 0) return [];

    // 3. For each reader, find other books they've read (cap at 50 readers)
    const bookFrequency = new Map<Id<"books">, number>();
    const readerArray = [...readerIds].slice(0, 50);

    const readerJourneyArrays = await Promise.all(
      readerArray.map((readerId) =>
        ctx.db
          .query("journeyEntries")
          .withIndex("by_reader", (q) => q.eq("readerId", readerId))
          .collect(),
      ),
    );

    // Batch-fetch all unique copy IDs across readers
    const allCopyIds = new Set<Id<"copies">>();
    for (const entries of readerJourneyArrays) {
      for (const e of entries) {
        if (e.returnedAt && !copyIds.has(e.copyId)) {
          allCopyIds.add(e.copyId);
        }
      }
    }
    const copyDocs = await Promise.all([...allCopyIds].map((id) => ctx.db.get(id)));
    const copyById = new Map<Id<"copies">, typeof copyDocs[number]>();
    for (let i = 0; i < copyDocs.length; i++) {
      const doc = copyDocs[i];
      if (doc) copyById.set(doc._id, doc);
    }

    for (const entries of readerJourneyArrays) {
      const seenBooks = new Set<Id<"books">>();
      for (const e of entries) {
        if (!e.returnedAt || copyIds.has(e.copyId)) continue;
        const copy = copyById.get(e.copyId);
        if (copy && copy.bookId !== args.bookId && !seenBooks.has(copy.bookId)) {
          seenBooks.add(copy.bookId);
          bookFrequency.set(
            copy.bookId,
            (bookFrequency.get(copy.bookId) ?? 0) + 1,
          );
        }
      }
    }

    if (bookFrequency.size === 0) return [];

    // 4. Sort by frequency, take top 8
    const sorted = [...bookFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // 5. Fetch book details and availability (indexed per-book, not full table scan)
    const topBookIds = sorted.map(([bookId]) => bookId);
    const copyCounts = await getBookCopyCountsFor(ctx, topBookIds);
    const results = await Promise.all(
      sorted.map(async ([bookId, readers]) => {
        const b = await ctx.db.get(bookId);
        if (!b) return null;
        const available = copyCounts.get(b._id)?.availableCopies ?? 0;
        return {
          _id: b._id,
          title: b.title,
          author: b.author,
          coverImage: b.coverImage,
          categories: b.categories,
          avgRating: b.avgRating,
          reviewCount: b.reviewCount,
          availableCopies: available,
          sharedReaders: readers,
        };
      }),
    );

    return results.filter((r) => r !== null);
  },
});
