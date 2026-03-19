"use client";

import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function ReviewVoteButtons({
  reviewId,
}: {
  reviewId: Id<"reviews">;
}) {
  const { isAuthenticated } = useConvexAuth();
  const data = useQuery(api.reviewVotes.forReview, { reviewId });
  const vote = useMutation(api.reviewVotes.vote);
  const removeVote = useMutation(api.reviewVotes.remove);

  if (data === undefined) return null;

  async function handleVote(helpful: boolean) {
    if (!isAuthenticated) return;
    try {
      if (data!.myVote === helpful) {
        await removeVote({ reviewId });
      } else {
        await vote({ reviewId, helpful });
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to vote"));
    }
  }

  const total = data.helpfulCount + data.unhelpfulCount;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => handleVote(true)}
        disabled={!isAuthenticated}
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] transition-colors",
          data.myVote === true
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          !isAuthenticated && "cursor-default opacity-50",
        )}
        aria-label="Helpful"
      >
        <ThumbsUp
          className={cn(
            "h-3 w-3",
            data.myVote === true && "fill-current",
          )}
        />
        {data.helpfulCount > 0 && <span>{data.helpfulCount}</span>}
      </button>
      <button
        type="button"
        onClick={() => handleVote(false)}
        disabled={!isAuthenticated}
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] transition-colors",
          data.myVote === false
            ? "bg-destructive/10 text-destructive"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          !isAuthenticated && "cursor-default opacity-50",
        )}
        aria-label="Not helpful"
      >
        <ThumbsDown
          className={cn(
            "h-3 w-3",
            data.myVote === false && "fill-current",
          )}
        />
        {data.unhelpfulCount > 0 && <span>{data.unhelpfulCount}</span>}
      </button>
      {total > 0 && (
        <span className="text-[0.6875rem] text-muted-foreground/60">
          {data.helpfulCount} of {total} found helpful
        </span>
      )}
    </div>
  );
}
