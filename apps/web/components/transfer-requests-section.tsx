"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowRightLeft, MapPin, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import Link from "next/link";

export function TransferRequestsSection() {
  const { isAuthenticated } = useConvexAuth();
  const requests = useQuery(
    api.transferRequests.myRequests,
    isAuthenticated ? {} : "skip",
  );
  const cancelRequest = useMutation(api.transferRequests.cancel);

  if (!requests) return null;

  const pending = requests.filter((r) => r.status === "pending");
  const recentAccepted = requests.filter(
    (r) =>
      r.status === "accepted" &&
      r.resolvedAt &&
      r.resolvedAt > Date.now() - 7 * 24 * 60 * 60 * 1000,
  );

  if (pending.length === 0 && recentAccepted.length === 0) return null;

  async function handleCancel(requestId: typeof pending[0]["_id"]) {
    try {
      await cancelRequest({ requestId });
      toast.success("Transfer request cancelled");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to cancel request"));
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
          <ArrowRightLeft className="h-4.5 w-4.5 text-primary" />
          Transfer Requests
        </h2>
        <Link
          href="/transfer-requests"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="space-y-2">
        {/* Recently accepted */}
        {recentAccepted.map((req) => (
          <div
            key={req._id}
            className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950"
          >
            <ArrowRightLeft className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{req.bookTitle}</p>
              <p className="text-xs text-green-700 dark:text-green-400">
                Transferred to {req.toLocationName}
              </p>
            </div>
            <Link
              href={`/book/${req.bookId}`}
              className="shrink-0 rounded-lg border border-border/50 bg-card px-2.5 py-1 text-[0.6875rem] font-medium transition-colors hover:bg-muted"
            >
              Reserve
            </Link>
          </div>
        ))}

        {/* Pending requests */}
        {pending.map((req) => (
          <div
            key={req._id}
            className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-3"
          >
            <Clock className="h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{req.bookTitle}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{req.fromLocationName}</span>
                <ArrowRightLeft className="h-3 w-3 shrink-0" />
                <span className="truncate">{req.toLocationName}</span>
              </div>
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
