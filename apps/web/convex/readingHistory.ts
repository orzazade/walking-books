import { query } from "./_generated/server";
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

    // Batch-fetch copies
    const copies = await Promise.all(
      completed.map((e) => ctx.db.get(e.copyId)),
    );

    // Batch-fetch unique books and locations upfront (cache inside Promise.all is race-prone)
    const bookIds = [...new Set(
      copies.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => c.bookId),
    )];
    const locationIds = [...new Set(
      completed.flatMap((e) =>
        [e.pickupLocationId, e.dropoffLocationId].filter(
          (id): id is NonNullable<typeof id> => id !== undefined,
        ),
      ),
    )];

    const [bookDocs, locationDocs] = await Promise.all([
      Promise.all(bookIds.map((id) => ctx.db.get(id))),
      Promise.all(locationIds.map((id) => ctx.db.get(id))),
    ]);

    const bookMap = new Map(bookIds.map((id, i) => [id, bookDocs[i]] as const));
    const locationMap = new Map(locationIds.map((id, i) => [id, locationDocs[i]] as const));

    const history = completed.map((entry, i) => {
      const copy = copies[i];
      const book = copy ? bookMap.get(copy.bookId) ?? null : null;
      const pickupLocation = locationMap.get(entry.pickupLocationId);
      const dropoffLocation = entry.dropoffLocationId
        ? locationMap.get(entry.dropoffLocationId)
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
    });

    // Sort by most recently returned first
    return history.sort((a, b) => b.returnedAt - a.returnedAt);
  },
});
