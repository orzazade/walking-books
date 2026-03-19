import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

interface Achievement {
  key: string;
  name: string;
  description: string;
  unlocked: boolean;
}

type AchievementDef = {
  key: string;
  name: string;
  description: string;
  check: (stats: UserStats) => boolean;
};

interface UserStats {
  booksRead: number;
  booksShared: number;
  reviewCount: number;
  genreCount: number;
  locationCount: number;
  followingCount: number;
  collectionCount: number;
  goalCompleted: boolean;
}

const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "first_read",
    name: "First Steps",
    description: "Completed your first book",
    check: (s) => s.booksRead >= 1,
  },
  {
    key: "books_read_5",
    name: "Bookworm",
    description: "Completed 5 books",
    check: (s) => s.booksRead >= 5,
  },
  {
    key: "books_read_25",
    name: "Book Lover",
    description: "Completed 25 books",
    check: (s) => s.booksRead >= 25,
  },
  {
    key: "books_shared_1",
    name: "Generous Soul",
    description: "Shared your first book",
    check: (s) => s.booksShared >= 1,
  },
  {
    key: "books_shared_5",
    name: "Community Builder",
    description: "Shared 5 books with the community",
    check: (s) => s.booksShared >= 5,
  },
  {
    key: "first_review",
    name: "Critic",
    description: "Wrote your first review",
    check: (s) => s.reviewCount >= 1,
  },
  {
    key: "reviews_10",
    name: "Literary Voice",
    description: "Wrote 10 reviews",
    check: (s) => s.reviewCount >= 10,
  },
  {
    key: "genres_3",
    name: "Explorer",
    description: "Read books in 3 different genres",
    check: (s) => s.genreCount >= 3,
  },
  {
    key: "genres_5",
    name: "Renaissance Reader",
    description: "Read books in 5 different genres",
    check: (s) => s.genreCount >= 5,
  },
  {
    key: "locations_3",
    name: "Wanderer",
    description: "Picked up books from 3 different locations",
    check: (s) => s.locationCount >= 3,
  },
  {
    key: "first_follow",
    name: "Social Reader",
    description: "Followed another reader",
    check: (s) => s.followingCount >= 1,
  },
  {
    key: "goal_completed",
    name: "Goal Getter",
    description: "Completed an annual reading goal",
    check: (s) => s.goalCompleted,
  },
  {
    key: "collection_created",
    name: "Curator",
    description: "Created a book collection",
    check: (s) => s.collectionCount >= 1,
  },
];

async function gatherStats(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<UserStats> {
  const [journeyEntries, copies, reviews, following, collections, goals] =
    await Promise.all([
      ctx.db
        .query("journeyEntries")
        .withIndex("by_reader", (q) => q.eq("readerId", userId))
        .collect(),
      ctx.db
        .query("copies")
        .withIndex("by_sharer", (q) => q.eq("originalSharerId", userId))
        .collect(),
      ctx.db
        .query("reviews")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("follows")
        .withIndex("by_follower", (q) => q.eq("followerId", userId))
        .collect(),
      ctx.db
        .query("collections")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("readingGoals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

  const completedReads = journeyEntries.filter(
    (e): e is typeof e & { returnedAt: number } => e.returnedAt !== undefined,
  );

  // Genre count from completed reads
  const copyIds = [...new Set(completedReads.map((e) => e.copyId))];
  const copyDocs = await Promise.all(copyIds.map((id) => ctx.db.get(id)));
  const bookIds = [
    ...new Set(
      copyDocs.filter((c) => c !== null).map((c) => c.bookId),
    ),
  ];
  const bookDocs = await Promise.all(bookIds.map((id) => ctx.db.get(id)));
  const genres = new Set<string>();
  for (const book of bookDocs) {
    if (!book) continue;
    for (const cat of book.categories) {
      genres.add(cat);
    }
  }

  // Unique pickup locations
  const locations = new Set(
    journeyEntries.map((e) => e.pickupLocationId),
  );

  // Check if any reading goal is completed
  let goalCompleted = false;
  for (const goal of goals) {
    const yearStart = new Date(goal.year, 0, 1).getTime();
    const yearEnd = new Date(goal.year + 1, 0, 1).getTime();
    const yearReads = completedReads.filter(
      (e) => e.returnedAt >= yearStart && e.returnedAt < yearEnd,
    ).length;
    if (yearReads >= goal.targetBooks) {
      goalCompleted = true;
      break;
    }
  }

  return {
    booksRead: completedReads.length,
    booksShared: copies.length,
    reviewCount: reviews.length,
    genreCount: genres.size,
    locationCount: locations.size,
    followingCount: following.length,
    collectionCount: collections.length,
    goalCompleted,
  };
}

export const myAchievements = query({
  args: {},
  handler: async (ctx): Promise<Achievement[]> => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const stats = await gatherStats(ctx, user._id);
    return ACHIEVEMENTS.map((a) => ({
      key: a.key,
      name: a.name,
      description: a.description,
      unlocked: a.check(stats),
    }));
  },
});

export const forUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Achievement[]> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const stats = await gatherStats(ctx, args.userId);
    return ACHIEVEMENTS.filter((a) => a.check(stats)).map((a) => ({
      key: a.key,
      name: a.name,
      description: a.description,
      unlocked: true,
    }));
  },
});
