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
    const completed = entries.filter((e) => e.returnedAt !== undefined);

    const history = await Promise.all(
      completed.map(async (entry) => {
        const copy = await ctx.db.get(entry.copyId);
        const book = copy ? await ctx.db.get(copy.bookId) : null;
        const pickupLocation = await ctx.db.get(entry.pickupLocationId);
        const dropoffLocation = entry.dropoffLocationId
          ? await ctx.db.get(entry.dropoffLocationId)
          : null;

        return {
          _id: entry._id,
          bookId: copy?.bookId,
          title: book?.title ?? "Unknown",
          author: book?.author ?? "Unknown",
          coverImage: book?.coverImage ?? "",
          categories: book?.categories ?? [],
          pickedUpAt: entry.pickedUpAt,
          returnedAt: entry.returnedAt!,
          daysHeld: Math.ceil(
            (entry.returnedAt! - entry.pickedUpAt) / DAY_MS,
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
