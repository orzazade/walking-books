"use client";

import { useState } from "react";
import { useQuery, useMutation, Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { ReviewVoteButtons } from "@/components/review-votes";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";

export function BookReviewsSection({ bookId }: { bookId: Id<"books"> }) {
  const reviews = useQuery(api.reviews.byBook, { bookId });
  const createReview = useMutation(api.reviews.create);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmitReview() {
    if (reviewRating === 0 || !reviewText.trim()) return;
    setSubmitting(true);
    try {
      await createReview({
        bookId,
        rating: reviewRating,
        text: reviewText.trim(),
      });
      setReviewRating(0);
      setReviewText("");
      toast.success("Review submitted!");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to submit review"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <div className="mb-4">
        <div className="section-kicker mb-2">Community</div>
        <h2 className="font-serif text-[1.25rem] font-semibold">Reviews</h2>
      </div>

      {reviews === undefined ? (
        <div className="animate-shimmer h-16 rounded-xl bg-muted" />
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-10 text-center text-[0.8125rem] text-muted-foreground">
          No reviews yet. Be the first to share your thoughts.
        </div>
      ) : (
        <div className="space-y-2.5">
          {reviews.map((review) => (
            <div
              key={review._id}
              className="rounded-xl border border-border/40 bg-card/60 p-4"
            >
              <StarRating rating={review.rating} />
              <p className="mt-2 text-[0.8125rem] leading-relaxed">
                {review.text}
              </p>
              <div className="mt-2.5">
                <ReviewVoteButtons reviewId={review._id} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Authenticated>
        <div className="mt-6 rounded-2xl border border-border/40 bg-card/60 p-5">
          <h3 className="mb-3 font-serif text-[0.9375rem] font-semibold">
            Write a Review
          </h3>
          <div className="space-y-3">
            <StarRating
              rating={reviewRating}
              onChange={setReviewRating}
              readonly={false}
            />
            <Textarea
              placeholder="Share your thoughts about this book..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={3}
              className="rounded-lg text-[0.8125rem]"
            />
            <Button
              onClick={handleSubmitReview}
              disabled={
                submitting || reviewRating === 0 || !reviewText.trim()
              }
              className="h-8 rounded-lg text-[0.75rem]"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </Button>
          </div>
        </div>
      </Authenticated>
    </section>
  );
}
