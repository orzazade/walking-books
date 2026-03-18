import type { QueryCtx } from "../_generated/server";

export type BookCopyCounts = { totalCopies: number; availableCopies: number };

/** Query all copies and return per-book total/available counts. */
export async function getBookCopyCounts(
  ctx: QueryCtx,
): Promise<Map<string, BookCopyCounts>> {
  const copies = await ctx.db.query("copies").collect();
  const counts = new Map<string, BookCopyCounts>();

  for (const copy of copies) {
    const current = counts.get(copy.bookId) ?? {
      totalCopies: 0,
      availableCopies: 0,
    };
    current.totalCopies += 1;
    if (copy.status === "available") {
      current.availableCopies += 1;
    }
    counts.set(copy.bookId, current);
  }

  return counts;
}
