"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HandHeart, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import Link from "next/link";

export function PendingRequestsSection() {
  const { isAuthenticated } = useConvexAuth();
  const requests = useQuery(
    api.bookRequests.myRequests,
    isAuthenticated ? {} : "skip",
  );
  const cancelRequest = useMutation(api.bookRequests.cancel);

  if (!requests) return null;

  const openRequests = requests.filter((r) => r.status === "open");
  const recentFulfilled = requests.filter(
    (r) => r.status === "fulfilled" && r.fulfilledAt && r.fulfilledAt > Date.now() - 7 * 24 * 60 * 60 * 1000,
  );

  if (openRequests.length === 0 && recentFulfilled.length === 0) return null;

  async function handleCancel(requestId: typeof openRequests[0]["_id"]) {
    try {
      await cancelRequest({ requestId });
      toast.success("Request cancelled");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to cancel request"));
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
          <HandHeart className="h-4.5 w-4.5 text-primary" />
          Book Requests
        </h2>
        <Link
          href="/book-requests"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="space-y-2">
        {/* Recently fulfilled */}
        {recentFulfilled.map((req) => (
          <div
            key={req._id}
            className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {req.title}
                {req.author && (
                  <span className="text-muted-foreground"> by {req.author}</span>
                )}
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                Fulfilled — check the catalog!
              </p>
            </div>
            <Link
              href="/search"
              className="shrink-0 rounded-lg border border-border/50 bg-card px-2.5 py-1 text-[0.6875rem] font-medium transition-colors hover:bg-muted"
            >
              Find it
            </Link>
          </div>
        ))}

        {/* Open requests */}
        {openRequests.map((req) => (
          <div
            key={req._id}
            className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-3"
          >
            <HandHeart className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {req.title}
                {req.author && (
                  <span className="text-muted-foreground"> by {req.author}</span>
                )}
              </p>
              {req.note && (
                <p className="truncate text-xs text-muted-foreground">
                  {req.note}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleCancel(req._id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Cancel request"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
