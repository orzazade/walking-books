import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser } from "./lib/auth";
import { DAY_MS } from "./lib/lending";

export const myHistory = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const entries = await ctx.db
      .query("journeyEntries")
      .withIndex("by_reader", (q) => q.eq("readerId", user._id))
      .collect();

    // Only include completed reads (returned books)
    const completed = entries.filter(
      (e): e is typeof e & { returnedAt: number } =>
        e.returnedAt !== undefined,
    );

    // Batch-fetch copies, then cache books and locations to avoid redundant lookups
    const copies = await Promise.all(
      completed.map((e) => ctx.db.get(e.copyId)),
    );

    const bookCache = new Map<string, Doc<"books"> | null>();
    const locationCache = new Map<string, Doc<"partnerLocations"> | null>();

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

    const history = await Promise.all(
      completed.map(async (entry, i) => {
        const copy = copies[i];
        const book = copy ? await getBook(copy.bookId) : null;
        const pickupLocation = await getLocation(entry.pickupLocationId);
        const dropoffLocation = entry.dropoffLocationId
          ? await getLocation(entry.dropoffLocationId)
          : null;

        return {
          _id: entry._id,
          bookId: copy?.bookId,
          title: book?.title ?? "Unknown",
          author: book?.author ?? "Unknown",
          coverImage: book?.coverImage ?? "",
          categories: book?.categories ?? [],
          pickedUpAt: entry.pickedUpAt,
          returnedAt: entry.returnedAt,
          daysHeld: Math.ceil(
            (entry.returnedAt - entry.pickedUpAt) / DAY_MS,
          ),
          pickupLocation: pickupLocation?.name ?? "Unknown",
          dropoffLocation: dropoffLocation?.name ?? null,
          readerNote: entry.readerNote ?? null,
          conditionAtPickup: entry.conditionAtPickup,
          conditionAtReturn: entry.conditionAtReturn ?? null,
        };
      }),
    );

    // Sort by most recently returned first
    return history.sort((a, b) => b.returnedAt - a.returnedAt);
  },
});
