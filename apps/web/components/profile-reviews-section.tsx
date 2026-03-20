"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { StarRating } from "@/components/star-rating";
import { ReviewVoteButtons } from "@/components/review-votes";
import { Star, BookOpen } from "lucide-react";
import Link from "next/link";

export function ProfileReviewsSection({ userId }: { userId: Id<"users"> }) {
  const reviews = useQuery(api.reviews.byUser, { userId });

  if (reviews === undefined) {
    return (
      <div className="space-y-2.5">
        {[1, 2].map((i) => (
          <div key={i} className="animate-shimmer h-24 rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-500" />
        <h2 className="font-serif text-[1rem] font-semibold">Reviews</h2>
        <span className="text-[0.75rem] text-muted-foreground">
          {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
        </span>
      </div>
      <div className="space-y-2.5">
        {reviews.map((review) => (
          <div
            key={review._id}
            className="rounded-xl border border-border/40 bg-card/60 p-4"
          >
            <div className="flex items-start gap-3">
              {review.bookCoverImage ? (
                <img
                  src={review.bookCoverImage}
                  alt={review.bookTitle}
                  className="h-14 w-10 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-14 w-10 items-center justify-center rounded-md bg-muted">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/book/${review.bookId}`}
                  className="text-[0.8125rem] font-medium hover:underline"
                >
                  {review.bookTitle}
                </Link>
                <p className="text-[0.6875rem] text-muted-foreground">
                  {review.bookAuthor}
                </p>
                <div className="mt-1">
                  <StarRating rating={review.rating} />
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-[0.8125rem] leading-relaxed">
              {review.text}
            </p>
            <div className="mt-2.5">
              <ReviewVoteButtons reviewId={review._id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
