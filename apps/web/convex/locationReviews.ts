import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireCurrentUser, getCurrentUser } from "./lib/auth";

export const create = mutation({
  args: {
    locationId: v.id("partnerLocations"),
    rating: v.number(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    if (args.rating < 1 || args.rating > 5 || !Number.isInteger(args.rating))
      throw new Error("Rating must be an integer between 1 and 5");
    const trimmedText = args.text.trim();
    if (trimmedText.length === 0)
      throw new Error("Review text is required");
    if (trimmedText.length > 5000)
      throw new Error("Review text must be 5000 characters or less");

    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");

    // Prevent staff/manager from reviewing their own location
    if (
      location.managedByUserId === user._id ||
      location.staffUserIds.includes(user._id)
    )
      throw new Error("You cannot review a location you manage or work at");

    // Upsert: one review per user per location
    const existing = await ctx.db
      .query("locationReviews")
      .withIndex("by_user_location", (q) =>
        q.eq("userId", user._id).eq("locationId", args.locationId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        text: trimmedText,
      });

      // Recalculate average with updated rating
      if (location.reviewCount > 0) {
        const newAvg =
          (location.avgRating * location.reviewCount -
            existing.rating +
            args.rating) /
          location.reviewCount;
        await ctx.db.patch(args.locationId, {
          avgRating: Math.round(newAvg * 10) / 10,
        });
      }

      return existing._id;
    }

    const reviewId = await ctx.db.insert("locationReviews", {
      locationId: args.locationId,
      userId: user._id,
      rating: args.rating,
      text: trimmedText,
    });

    // Update location aggregate rating
    const newCount = location.reviewCount + 1;
    const newAvg =
      (location.avgRating * location.reviewCount + args.rating) / newCount;
    await ctx.db.patch(args.locationId, {
      avgRating: Math.round(newAvg * 10) / 10,
      reviewCount: newCount,
    });

    return reviewId;
  },
});

export const byLocation = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("locationReviews")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();

    // Enrich with user names
    const enriched = await Promise.all(
      reviews.map(async (review) => {
        const user = await ctx.db.get(review.userId);
        return {
          ...review,
          userName: user?.name ?? "Unknown",
        };
      }),
    );

    return enriched;
  },
});

export const myReview = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("locationReviews")
      .withIndex("by_user_location", (q) =>
        q.eq("userId", user._id).eq("locationId", args.locationId),
      )
      .unique();
  },
});
