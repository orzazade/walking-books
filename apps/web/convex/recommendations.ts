import { query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

export const forMe = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // Collect book IDs the user has already read
    const journeyEntries = await ctx.db
      .query("journeyEntries")
      .withIndex("by_reader", (q) => q.eq("readerId", user._id))
      .collect();
    const readCopyIds = journeyEntries.map((e) => e.copyId);
    const readBookIds = new Set<string>();
    for (const copyId of readCopyIds) {
      const copy = await ctx.db.get(copyId);
      if (copy) readBookIds.add(copy.bookId);
    }

    // Collect book IDs the user currently has checked out
    const checkedOutCopies = await ctx.db
      .query("copies")
      .withIndex("by_holder", (q) => q.eq("currentHolderId", user._id))
      .collect();
    for (const copy of checkedOutCopies) {
      readBookIds.add(copy.bookId);
    }

    // Get all copies for availability counts
    const allCopies = await ctx.db.query("copies").collect();
    const availabilityMap = new Map<string, number>();
    for (const copy of allCopies) {
      if (copy.status === "available") {
        availabilityMap.set(
          copy.bookId,
          (availabilityMap.get(copy.bookId) ?? 0) + 1,
        );
      }
    }

    // Get all books, exclude already-read ones
    const allBooks = await ctx.db.query("books").collect();
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
      const available = availabilityMap.get(book._id) ?? 0;
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
