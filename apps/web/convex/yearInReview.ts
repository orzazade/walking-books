import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getCurrentUser } from "./lib/auth";
import { DAY_MS } from "./lib/lending";

export const getReview = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2100)
      throw new Error("Invalid year");

    const yearStart = new Date(args.year, 0, 1).getTime();
    const yearEnd = new Date(args.year + 1, 0, 1).getTime();

    // Fetch all journey entries for this user
    const allEntries = await ctx.db
      .query("journeyEntries")
      .withIndex("by_reader", (q) => q.eq("readerId", user._id))
      .collect();

    const yearEntries = allEntries.filter(
      (e): e is typeof e & { returnedAt: number } =>
        e.returnedAt !== undefined &&
        e.returnedAt >= yearStart &&
        e.returnedAt < yearEnd,
    );

    const booksStarted = allEntries.filter(
      (e) => e.pickedUpAt >= yearStart && e.pickedUpAt < yearEnd,
    ).length;

    const totalBooksRead = yearEntries.length;

    if (totalBooksRead === 0) {
      return {
        year: args.year,
        totalBooksRead: 0,
        booksStarted,
        totalPagesRead: 0,
        avgDaysPerBook: null,
        topGenres: [],
        monthlyActivity: buildEmptyMonths(args.year),
        uniqueLocationsVisited: 0,
        topLocations: [],
        reviewsWritten: 0,
        avgRatingGiven: null,
        longestStreak: 0,
        goalTarget: null,
        goalProgress: null,
        fastestRead: null,
        mostReadAuthor: null,
      };
    }

    // Batch-fetch copies and books to avoid N+1
    const copyIds = [...new Set(yearEntries.map((e) => e.copyId))];
    const copyDocs = await Promise.all(copyIds.map((id) => ctx.db.get(id)));
    const copyMap = new Map(
      copyDocs.filter((c) => c !== null).map((c) => [c._id, c]),
    );

    const bookIds = [
      ...new Set(
        copyDocs.filter((c) => c !== null).map((c) => c.bookId),
      ),
    ];
    const bookDocs = await Promise.all(bookIds.map((id) => ctx.db.get(id)));
    const bookMap = new Map(
      bookDocs.filter((b) => b !== null).map((b) => [b._id, b]),
    );

    // Total pages read
    let totalPagesRead = 0;
    for (const entry of yearEntries) {
      const copy = copyMap.get(entry.copyId);
      if (!copy) continue;
      const book = bookMap.get(copy.bookId);
      if (book) totalPagesRead += book.pageCount;
    }

    // Average days per book
    const totalDays = yearEntries.reduce((sum, e) => {
      return sum + (e.returnedAt - e.pickedUpAt) / DAY_MS;
    }, 0);
    const avgDaysPerBook =
      Math.round((totalDays / totalBooksRead) * 10) / 10;

    // Genre breakdown
    const genreCounts: Record<string, number> = {};
    const authorCounts: Record<string, number> = {};
    for (const entry of yearEntries) {
      const copy = copyMap.get(entry.copyId);
      if (!copy) continue;
      const book = bookMap.get(copy.bookId);
      if (!book) continue;
      for (const genre of book.categories) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
      authorCounts[book.author] = (authorCounts[book.author] || 0) + 1;
    }

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));

    // Most read author
    const authorEntries = Object.entries(authorCounts).sort(
      (a, b) => b[1] - a[1],
    );
    const mostReadAuthor =
      authorEntries.length > 0
        ? { author: authorEntries[0][0], count: authorEntries[0][1] }
        : null;

    // Monthly activity
    const monthlyActivity = buildEmptyMonths(args.year);
    for (const entry of yearEntries) {
      const month = new Date(entry.returnedAt).getMonth();
      monthlyActivity[month].count++;
    }

    // Locations visited
    const locationCounts = new Map<Id<"partnerLocations">, number>();
    for (const entry of yearEntries) {
      const locId = entry.pickupLocationId;
      locationCounts.set(locId, (locationCounts.get(locId) || 0) + 1);
    }

    const locationIds = [...locationCounts.keys()];
    const locationDocs = await Promise.all(
      locationIds.map((id) => ctx.db.get(id)),
    );
    const topLocations = locationIds
      .map((id, i) => ({
        name: locationDocs[i]?.name ?? "Unknown",
        count: locationCounts.get(id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Reviews, streak, and goal are independent — fetch in parallel
    const [reviews, streak, goal] = await Promise.all([
      ctx.db.query("reviews")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db.query("readingStreaks")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first(),
      ctx.db.query("readingGoals")
        .withIndex("by_user_year", (q) =>
          q.eq("userId", user._id).eq("year", args.year),
        )
        .unique(),
    ]);

    const yearReviews = reviews.filter(
      (r) => r._creationTime >= yearStart && r._creationTime < yearEnd,
    );
    const reviewsWritten = yearReviews.length;
    const avgRatingGiven =
      yearReviews.length > 0
        ? Math.round(
            (yearReviews.reduce((sum, r) => sum + r.rating, 0) /
              yearReviews.length) *
              10,
          ) / 10
        : null;

    const longestStreak = streak?.longestStreak ?? 0;

    const goalTarget = goal?.targetBooks ?? null;
    const goalProgress =
      goal && goal.targetBooks > 0
        ? Math.min(
            100,
            Math.round((totalBooksRead / goal.targetBooks) * 100),
          )
        : null;

    // Fastest read
    let fastestRead: { title: string; author: string; days: number } | null =
      null;
    for (const entry of yearEntries) {
      const days =
        Math.round(((entry.returnedAt - entry.pickedUpAt) / DAY_MS) * 10) /
        10;
      if (!fastestRead || days < fastestRead.days) {
        const copy = copyMap.get(entry.copyId);
        const book = copy ? bookMap.get(copy.bookId) : null;
        if (book) {
          fastestRead = { title: book.title, author: book.author, days };
        }
      }
    }

    return {
      year: args.year,
      totalBooksRead,
      booksStarted,
      totalPagesRead,
      avgDaysPerBook,
      topGenres,
      monthlyActivity,
      uniqueLocationsVisited: locationCounts.size,
      topLocations,
      reviewsWritten,
      avgRatingGiven,
      longestStreak,
      goalTarget,
      goalProgress,
      fastestRead,
      mostReadAuthor,
    };
  },
});

function buildEmptyMonths(year: number) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return months.map((m) => ({ month: `${m} ${year}`, count: 0 }));
}
