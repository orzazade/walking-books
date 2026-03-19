import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";

type SharerFeedItem = {
  type: "pickup" | "return" | "condition_report" | "review";
  timestamp: number;
  copy: { _id: Id<"copies">; condition: string };
  book: { _id: Id<"books">; title: string; author: string; coverImage: string };
  reader: { _id: Id<"users">; name: string; avatarUrl?: string } | null;
  detail: {
    locationName?: string;
    rating?: number;
    reviewText?: string;
    previousCondition?: string;
    newCondition?: string;
    reportType?: string;
  };
};

export const feed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<SharerFeedItem[]> => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));

    // Get all copies shared by this user
    const copies = await ctx.db
      .query("copies")
      .withIndex("by_sharer", (q) => q.eq("originalSharerId", user._id))
      .collect();

    if (copies.length === 0) return [];

    // Build book ID set for batch review queries
    const bookIds = new Set<Id<"books">>();
    for (const copy of copies) {
      bookIds.add(copy.bookId);
    }

    // Batch-fetch journey entries, condition reports, and reviews in parallel
    const [journeyArrays, reportArrays, reviewArrays] = await Promise.all([
      Promise.all(
        copies.map((copy) =>
          ctx.db
            .query("journeyEntries")
            .withIndex("by_copy", (q) => q.eq("copyId", copy._id))
            .order("desc")
            .take(limit),
        ),
      ),
      Promise.all(
        copies.map((copy) =>
          ctx.db
            .query("conditionReports")
            .withIndex("by_copy", (q) => q.eq("copyId", copy._id))
            .order("desc")
            .take(limit),
        ),
      ),
      Promise.all(
        [...bookIds].map((bookId) =>
          ctx.db
            .query("reviews")
            .withIndex("by_book", (q) => q.eq("bookId", bookId))
            .order("desc")
            .take(limit),
        ),
      ),
    ]);

    // Caches to avoid redundant lookups
    const userCache = new Map<string, Doc<"users"> | null>();
    const bookCache = new Map<string, Doc<"books"> | null>();
    const locationCache = new Map<string, Doc<"partnerLocations"> | null>();

    async function getUser(id: Id<"users">) {
      const cached = userCache.get(id);
      if (cached !== undefined) return cached;
      const u = await ctx.db.get(id);
      userCache.set(id, u);
      return u;
    }

    async function getBook(id: Id<"books">) {
      const cached = bookCache.get(id);
      if (cached !== undefined) return cached;
      const b = await ctx.db.get(id);
      bookCache.set(id, b);
      return b;
    }

    async function getLocation(id: Id<"partnerLocations">) {
      const cached = locationCache.get(id);
      if (cached !== undefined) return cached;
      const l = await ctx.db.get(id);
      locationCache.set(id, l);
      return l;
    }

    function makeCopyRef(copy: Doc<"copies">) {
      return { _id: copy._id, condition: copy.condition };
    }

    function makeBookRef(book: Doc<"books">) {
      return { _id: book._id, title: book.title, author: book.author, coverImage: book.coverImage };
    }

    function makeUserRef(u: Doc<"users">) {
      return { _id: u._id, name: u.name, avatarUrl: u.avatarUrl };
    }

    const items: SharerFeedItem[] = [];

    // Process journey entries (pickups & returns)
    for (let i = 0; i < copies.length; i++) {
      const copy = copies[i];
      const book = await getBook(copy.bookId);
      if (!book) continue;

      for (const entry of journeyArrays[i]) {
        const reader = await getUser(entry.readerId);
        const pickupLocation = await getLocation(entry.pickupLocationId);

        items.push({
          type: "pickup",
          timestamp: entry.pickedUpAt,
          copy: makeCopyRef(copy),
          book: makeBookRef(book),
          reader: reader ? makeUserRef(reader) : null,
          detail: { locationName: pickupLocation?.name },
        });

        if (entry.returnedAt) {
          const dropoffLocation = entry.dropoffLocationId
            ? await getLocation(entry.dropoffLocationId)
            : null;
          items.push({
            type: "return",
            timestamp: entry.returnedAt,
            copy: makeCopyRef(copy),
            book: makeBookRef(book),
            reader: reader ? makeUserRef(reader) : null,
            detail: { locationName: dropoffLocation?.name },
          });
        }
      }
    }

    // Process condition reports
    for (let i = 0; i < copies.length; i++) {
      const copy = copies[i];
      const book = await getBook(copy.bookId);
      if (!book) continue;

      for (const report of reportArrays[i]) {
        const reporter = report.reportedByUserId
          ? await getUser(report.reportedByUserId)
          : null;

        items.push({
          type: "condition_report",
          timestamp: report.createdAt,
          copy: makeCopyRef(copy),
          book: makeBookRef(book),
          reader: reporter ? makeUserRef(reporter) : null,
          detail: {
            previousCondition: report.previousCondition,
            newCondition: report.newCondition,
            reportType: report.type,
          },
        });
      }
    }

    // Process reviews (only for books the sharer has copies of)
    const bookIdArray = [...bookIds];
    for (let i = 0; i < bookIdArray.length; i++) {
      const bookId = bookIdArray[i];
      const book = await getBook(bookId);
      if (!book) continue;

      for (const review of reviewArrays[i]) {
        // Skip the sharer's own reviews
        if (review.userId === user._id) continue;

        const reviewer = await getUser(review.userId);
        if (!reviewer) continue;

        // Find a copy to reference (first copy of this book by the sharer)
        const matchingCopy = copies.find((c) => c.bookId === bookId);
        if (!matchingCopy) continue;

        items.push({
          type: "review",
          timestamp: review._creationTime,
          copy: makeCopyRef(matchingCopy),
          book: makeBookRef(book),
          reader: makeUserRef(reviewer),
          detail: { rating: review.rating, reviewText: review.text },
        });
      }
    }

    // Sort by most recent first and limit
    items.sort((a, b) => b.timestamp - a.timestamp);
    return items.slice(0, limit);
  },
});
