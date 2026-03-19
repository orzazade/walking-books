"use client";

import { useState } from "react";
import { useQuery, useMutation, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import { CreateRequestForm } from "@/components/create-request-form";
import { getErrorMessage, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import {
  HandHeart,
  Plus,
  CheckCircle2,
  Clock,
  Ban,
  MessageSquare,
} from "lucide-react";

const STATUS_CONFIG = {
  open: { label: "Open", icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10" },
  fulfilled: { label: "Fulfilled", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  cancelled: { label: "Cancelled", icon: Ban, color: "text-muted-foreground", bg: "bg-muted" },
} as const;

function CommunityBoard() {
  const { isAuthenticated } = useConvexAuth();
  const requests = useQuery(api.bookRequests.active, { limit: 50 });
  const myRequests = useQuery(
    api.bookRequests.myRequests,
    isAuthenticated ? {} : "skip",
  );
  const fulfill = useMutation(api.bookRequests.fulfill);
  const cancel = useMutation(api.bookRequests.cancel);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"board" | "mine">("board");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const myOpenIds = new Set(
    (myRequests ?? [])
      .filter((r) => r.status === "open")
      .map((r) => r._id),
  );

  async function handleFulfill(requestId: Id<"bookRequests">) {
    setActionLoading(requestId);
    try {
      await fulfill({ requestId });
      toast.success("Marked as fulfilled!");
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(requestId: Id<"bookRequests">) {
    setActionLoading(requestId);
    try {
      await cancel({ requestId });
      toast.success("Request cancelled");
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setActionLoading(null);
    }
  }

  // Loading
  if (requests === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/40 bg-card/60 p-4"
          >
            <div className="space-y-2">
              <div className="animate-shimmer h-5 w-48 rounded-md bg-muted" />
              <div className="animate-shimmer h-4 w-32 rounded-md bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      {isAuthenticated && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("board")}
            className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
              tab === "board"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Community Board
          </button>
          <button
            onClick={() => setTab("mine")}
            className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
              tab === "mine"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            My Requests
            {myRequests && myRequests.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground/20 text-[0.6875rem]">
                {myRequests.length}
              </span>
            )}
          </button>
          <div className="flex-1" />
          {!showForm && tab === "board" && (
            <Button
              onClick={() => setShowForm(true)}
              size="sm"
              className="rounded-lg text-[0.8125rem]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Request a Book
            </Button>
          )}
        </div>
      )}

      {/* Create form */}
      {showForm && <CreateRequestForm onClose={() => setShowForm(false)} />}

      {/* Board tab */}
      {tab === "board" && (
        <>
          {requests.length === 0 ? (
            <EmptyState
              icon={HandHeart}
              title="No open requests"
              message="Be the first to request a book the community doesn't have yet."
            >
              {isAuthenticated && (
                <Button
                  onClick={() => setShowForm(true)}
                  className="mt-4 rounded-lg text-[0.8125rem]"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Request a Book
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div
                  key={r._id}
                  className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium">{r.title}</h3>
                      {r.author && (
                        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                          by {r.author}
                        </p>
                      )}
                      {r.note && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] text-muted-foreground">
                          <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                          {r.note}
                        </p>
                      )}
                      <p className="mt-2 text-[0.75rem] text-muted-foreground/60">
                        Requested by {r.requesterName} &middot;{" "}
                        {timeAgo(r.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isAuthenticated && myOpenIds.has(r._id) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoading === r._id}
                          onClick={() => handleCancel(r._id)}
                          className="rounded-lg text-[0.75rem]"
                        >
                          {actionLoading === r._id ? "..." : "Cancel"}
                        </Button>
                      ) : isAuthenticated ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoading === r._id}
                          onClick={() => handleFulfill(r._id)}
                          className="rounded-lg text-[0.75rem]"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {actionLoading === r._id ? "..." : "I have this"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* My Requests tab */}
      {tab === "mine" && myRequests !== undefined && (
        <>
          {myRequests.length === 0 ? (
            <EmptyState
              icon={HandHeart}
              title="No requests yet"
              message="Request a book and the community might share it."
            />
          ) : (
            <div className="space-y-2">
              {myRequests.map((r) => {
                const status =
                  STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG];
                const StatusIcon = status?.icon ?? Clock;
                return (
                  <div
                    key={r._id}
                    className="rounded-xl border border-border/40 bg-card/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{r.title}</h3>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium ${status?.bg ?? ""} ${status?.color ?? ""}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status?.label ?? r.status}
                          </span>
                        </div>
                        {r.author && (
                          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                            by {r.author}
                          </p>
                        )}
                        {r.note && (
                          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
                            {r.note}
                          </p>
                        )}
                        <p className="mt-2 text-[0.75rem] text-muted-foreground/60">
                          {timeAgo(r.createdAt)}
                        </p>
                      </div>
                      {r.status === "open" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoading === r._id}
                          onClick={() => handleCancel(r._id)}
                          className="shrink-0 rounded-lg text-[0.75rem]"
                        >
                          {actionLoading === r._id ? "..." : "Cancel"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function BookRequestsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="section-kicker mb-3">Community</div>
        <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
          Book Requests
        </h1>
        <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
          Looking for a book? Post a request and fellow readers might share it.
        </p>
      </div>

      {/* Content */}
      <Authenticated>
        <CommunityBoard />
      </Authenticated>
      <Unauthenticated>
        <CommunityBoard />
        <div className="mt-6">
          <SignInPrompt message="Sign in to request books or help fulfill requests." />
        </div>
      </Unauthenticated>
    </main>
  );
}
