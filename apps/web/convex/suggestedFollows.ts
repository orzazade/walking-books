import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser } from "./lib/auth";

/**
 * Suggested follows — recommends readers with similar taste.
 * Finds users who have read the same books as the current user,
 * ranked by overlap count. Excludes already-followed users.
 */
export const forMe = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // 1. Get completed journeys and followed users in parallel (both only need user._id)
    const [myJourneys, followDocs] = await Promise.all([
      ctx.db.query("journeyEntries")
        .withIndex("by_reader", (q) => q.eq("readerId", user._id))
        .collect(),
      ctx.db.query("follows")
        .withIndex("by_follower", (q) => q.eq("followerId", user._id))
        .collect(),
    ]);

    // Resolve copy -> book mapping
    const myCopyIds = new Set<Id<"copies">>();
    for (const j of myJourneys) {
      if (j.returnedAt) myCopyIds.add(j.copyId);
    }
    if (myCopyIds.size === 0) return [];

    const myCopyDocs = await Promise.all(
      [...myCopyIds].map((id) => ctx.db.get(id)),
    );
    const myBookIds = new Set<Id<"books">>();
    for (const doc of myCopyDocs) {
      if (doc) myBookIds.add(doc.bookId);
    }
    if (myBookIds.size === 0) return [];

    // 2. Build followed set
    const followedIds = new Set<Id<"users">>(
      followDocs.map((f) => f.followingId),
    );

    // 3. For each book the user has read, find other readers
    // Use a book -> copies -> journeyEntries approach
    const bookCopiesArrays = await Promise.all(
      [...myBookIds].slice(0, 30).map((bookId) =>
        ctx.db
          .query("copies")
          .withIndex("by_book", (q) => q.eq("bookId", bookId))
          .collect(),
      ),
    );

    const allCopyIds = new Set<Id<"copies">>();
    const copyToBook = new Map<Id<"copies">, Id<"books">>();
    for (let i = 0; i < bookCopiesArrays.length; i++) {
      for (const copy of bookCopiesArrays[i]) {
        allCopyIds.add(copy._id);
        copyToBook.set(copy._id, copy.bookId);
      }
    }

    // Fetch journeyEntries for all those copies
    const journeyArrays = await Promise.all(
      [...allCopyIds].map((copyId) =>
        ctx.db
          .query("journeyEntries")
          .withIndex("by_copy", (q) => q.eq("copyId", copyId))
          .collect(),
      ),
    );

    // Count overlap: how many shared books each reader has with the current user
    const readerOverlap = new Map<Id<"users">, Set<Id<"books">>>();
    for (const entries of journeyArrays) {
      for (const entry of entries) {
        if (!entry.returnedAt) continue;
        if (entry.readerId === user._id) continue;
        if (followedIds.has(entry.readerId)) continue;

        const bookId = copyToBook.get(entry.copyId);
        if (!bookId || !myBookIds.has(bookId)) continue;

        let books = readerOverlap.get(entry.readerId);
        if (!books) {
          books = new Set();
          readerOverlap.set(entry.readerId, books);
        }
        books.add(bookId);
      }
    }

    if (readerOverlap.size === 0) return [];

    // 4. Sort by overlap count, take top 10
    const sorted = [...readerOverlap.entries()]
      .map(([readerId, books]) => ({ readerId, sharedBooks: books.size }))
      .sort((a, b) => {
        if (b.sharedBooks !== a.sharedBooks) return b.sharedBooks - a.sharedBooks;
        // Stable sort by ID
        return a.readerId < b.readerId ? -1 : 1;
      })
      .slice(0, 10);

    // 5. Fetch user profiles
    const results = await Promise.all(
      sorted.map(async ({ readerId, sharedBooks }) => {
        const u = await ctx.db.get(readerId);
        if (!u || u.status !== "active") return null;
        return {
          _id: u._id,
          name: u.name,
          avatarUrl: u.avatarUrl,
          booksRead: u.booksRead,
          sharedBooks,
        };
      }),
    );

    return results.filter((r) => r !== null);
  },
});
