"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import {
  HandHeart,
  Plus,
  X,
  CheckCircle2,
  Clock,
  Ban,
  MessageSquare,
} from "lucide-react";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const STATUS_CONFIG = {
  open: { label: "Open", icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10" },
  fulfilled: { label: "Fulfilled", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  cancelled: { label: "Cancelled", icon: Ban, color: "text-muted-foreground", bg: "bg-muted" },
} as const;

function CreateRequestForm({ onClose }: { onClose: () => void }) {
  const create = useMutation(api.bookRequests.create);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await create({
        title: title.trim(),
        author: author.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success("Request posted!");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold">Request a Book</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-[0.8125rem] font-medium">
            Book title <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dune"
            maxLength={300}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.8125rem] font-medium">
            Author <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="e.g. Frank Herbert"
            maxLength={200}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.8125rem] font-medium">
            Note <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Any edition preference, why you want it, etc."
            maxLength={500}
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-lg text-[0.8125rem]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || !title.trim()}
            className="rounded-lg text-[0.8125rem]"
          >
            {submitting ? "Posting..." : "Post Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}

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

  const myOpenIds = new Set(
    (myRequests ?? [])
      .filter((r) => r.status === "open")
      .map((r) => r._id),
  );

  async function handleFulfill(requestId: Id<"bookRequests">) {
    try {
      await fulfill({ requestId });
      toast.success("Marked as fulfilled!");
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    }
  }

  async function handleCancel(requestId: Id<"bookRequests">) {
    try {
      await cancel({ requestId });
      toast.success("Request cancelled");
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
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
            <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <HandHeart className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="font-serif text-lg font-semibold">
                No open requests
              </h2>
              <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
                Be the first to request a book the community doesn&apos;t have
                yet.
              </p>
              {isAuthenticated && (
                <Button
                  onClick={() => setShowForm(true)}
                  className="mt-4 rounded-lg text-[0.8125rem]"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Request a Book
                </Button>
              )}
            </div>
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
                          onClick={() => handleCancel(r._id)}
                          className="rounded-lg text-[0.75rem]"
                        >
                          Cancel
                        </Button>
                      ) : isAuthenticated ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFulfill(r._id)}
                          className="rounded-lg text-[0.75rem]"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          I have this
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
            <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <HandHeart className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="font-serif text-lg font-semibold">
                No requests yet
              </h2>
              <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
                Request a book and the community might share it.
              </p>
            </div>
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
                          onClick={() => handleCancel(r._id)}
                          className="shrink-0 rounded-lg text-[0.75rem]"
                        >
                          Cancel
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
