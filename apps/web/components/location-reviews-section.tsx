"use client";

import { useState } from "react";
import { useQuery, useMutation, useConvexAuth, Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { getErrorMessage } from "@/lib/utils";
import { Star, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export function LocationReviewsSection({
  locationId,
}: {
  locationId: Id<"partnerLocations">;
}) {
  const { isAuthenticated } = useConvexAuth();
  const reviews = useQuery(api.locationReviews.byLocation, { locationId });
  const myReview = useQuery(
    api.locationReviews.myReview,
    isAuthenticated ? { locationId } : "skip",
  );
  const createReview = useMutation(api.locationReviews.create);

  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (rating === 0 || !text.trim()) return;
    setSubmitting(true);
    try {
      await createReview({ locationId, rating, text: text.trim() });
      setRating(0);
      setText("");
      toast.success(myReview ? "Review updated" : "Review submitted!");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to submit review"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <MessageSquare className="h-5 w-5" />
        Reviews ({reviews?.length ?? 0})
      </h2>

      {reviews === undefined ? (
        <p className="text-muted-foreground">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground">
          No reviews yet. Be the first to share your experience.
        </p>
      ) : (
        <div className="space-y-2.5">
          {reviews.map((review) => (
            <div
              key={review._id}
              className="rounded-xl border border-border/40 bg-card/60 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[0.8125rem] font-medium">
                  {review.userName}
                </span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className={`h-3 w-3 ${
                        s < review.rating
                          ? "fill-amber-500 text-amber-500"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                {review.text}
              </p>
            </div>
          ))}
        </div>
      )}

      <Authenticated>
        <div className="mt-4 rounded-xl border border-border/40 bg-card/60 p-4">
          <h3 className="mb-3 text-[0.875rem] font-medium">
            {myReview ? "Update your review" : "Write a review"}
          </h3>
          <div className="space-y-3">
            <StarRating rating={rating} onChange={setRating} readonly={false} />
            <Textarea
              placeholder="Share your experience at this location..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={5000}
              className="rounded-lg text-[0.8125rem]"
            />
            <Button
              onClick={handleSubmit}
              disabled={submitting || rating === 0 || !text.trim()}
              size="sm"
              className="rounded-lg"
            >
              {submitting
                ? "Submitting..."
                : myReview
                  ? "Update Review"
                  : "Submit Review"}
            </Button>
          </div>
        </div>
      </Authenticated>
    </div>
  );
}
