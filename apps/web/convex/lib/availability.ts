import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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

/** Query copies for specific books using by_book index — avoids full table scan. */
export async function getBookCopyCountsFor(
  ctx: QueryCtx,
  bookIds: Id<"books">[],
): Promise<Map<string, BookCopyCounts>> {
  const copyArrays = await Promise.all(
    bookIds.map((bookId) =>
      ctx.db
        .query("copies")
        .withIndex("by_book", (q) => q.eq("bookId", bookId))
        .collect(),
    ),
  );
  const counts = new Map<string, BookCopyCounts>();
  for (let i = 0; i < bookIds.length; i++) {
    let totalCopies = 0;
    let availableCopies = 0;
    for (const copy of copyArrays[i]) {
      totalCopies++;
      if (copy.status === "available") availableCopies++;
    }
    counts.set(bookIds[i], { totalCopies, availableCopies });
  }
  return counts;
}
