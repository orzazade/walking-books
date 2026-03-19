"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import {
  BookOpen,
  BookCheck,
  BookX,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const STATUS_FILTERS = [
  { value: undefined, label: "All", icon: BookOpen },
  { value: "reading" as const, label: "Reading", icon: Clock },
  { value: "finished" as const, label: "Finished", icon: CheckCircle2 },
  { value: "abandoned" as const, label: "Abandoned", icon: XCircle },
];

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div
        className="h-1.5 rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function CurrentlyReadingSection() {
  const currentlyReading = useQuery(api.readingProgress.currentlyReading, {});
  const update = useMutation(api.readingProgress.update);
  const abandon = useMutation(api.readingProgress.abandon);
  const [updatingId, setUpdatingId] = useState<Id<"copies"> | null>(null);
  const [pageInput, setPageInput] = useState("");
  const [savingId, setSavingId] = useState<Id<"copies"> | null>(null);
  const [abandoningId, setAbandoningId] = useState<Id<"copies"> | null>(null);

  async function handleUpdate(copyId: Id<"copies">) {
    const page = parseInt(pageInput, 10);
    if (isNaN(page) || page < 0) {
      toast.error("Enter a valid page number");
      return;
    }
    setSavingId(copyId);
    try {
      await update({ copyId, currentPage: page });
      toast.success(page > 0 ? "Progress updated!" : "Progress saved!");
      setUpdatingId(null);
      setPageInput("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update progress"));
    } finally {
      setSavingId(null);
    }
  }

  async function handleAbandon(copyId: Id<"copies">) {
    setAbandoningId(copyId);
    try {
      await abandon({ copyId });
      toast.success("Reading marked as abandoned");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to abandon reading"));
    } finally {
      setAbandoningId(null);
    }
  }

  if (currentlyReading === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-card/60 p-4">
            <div className="flex gap-3">
              <div className="animate-shimmer h-20 w-14 rounded-md bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="animate-shimmer h-5 w-40 rounded-md bg-muted" />
                <div className="animate-shimmer h-4 w-28 rounded-md bg-muted" />
                <div className="animate-shimmer h-2 w-full rounded-full bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (currentlyReading.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Nothing in progress"
        message="Pick up a book to start tracking your reading progress."
      >
        <Link
          href="/browse"
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
        >
          Browse books
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {currentlyReading.map((item) => (
        <div
          key={item._id}
          className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
        >
          <div className="flex gap-3">
            {/* Cover */}
            <Link href={`/book/${item.bookId}`} className="shrink-0">
              {item.coverImage ? (
                <img
                  src={item.coverImage}
                  alt={item.bookTitle}
                  className="h-20 w-14 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-20 w-14 items-center justify-center rounded-md bg-muted">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </Link>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <Link href={`/book/${item.bookId}`} className="hover:underline">
                <h3 className="font-medium leading-tight">{item.bookTitle}</h3>
              </Link>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                {item.bookAuthor}
              </p>

              {/* Progress bar */}
              <div className="mt-2">
                <ProgressBar percent={item.percentComplete} />
                <div className="mt-1 flex items-center justify-between text-[0.75rem] text-muted-foreground">
                  <span>
                    Page {item.currentPage} of {item.totalPages}
                  </span>
                  <span className="font-medium">{item.percentComplete}%</span>
                </div>
              </div>

              {/* Update progress inline */}
              {updatingId === item.copyId ? (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    placeholder={`Page (0-${item.totalPages})`}
                    min={0}
                    max={item.totalPages}
                    className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-[0.8125rem] outline-none focus:ring-2 focus:ring-primary/30"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate(item.copyId);
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={savingId === item.copyId}
                    onClick={() => handleUpdate(item.copyId)}
                    className="rounded-lg text-[0.75rem]"
                  >
                    {savingId === item.copyId ? "Saving..." : "Save"}
                  </Button>
                  <button
                    onClick={() => { setUpdatingId(null); setPageInput(""); }}
                    className="text-[0.75rem] text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUpdatingId(item.copyId);
                      setPageInput(String(item.currentPage));
                    }}
                    className="rounded-lg text-[0.75rem]"
                  >
                    Update page
                  </Button>
                  <button
                    onClick={() => handleAbandon(item.copyId)}
                    disabled={abandoningId === item.copyId}
                    className="text-[0.75rem] text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    {abandoningId === item.copyId ? "..." : "Abandon"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadingHistory() {
  const [statusFilter, setStatusFilter] = useState<
    "reading" | "finished" | "abandoned" | undefined
  >(undefined);
  const readings = useQuery(api.readingProgress.myReadings, {
    status: statusFilter,
  });

  return (
    <div className="mt-8">
      <h2 className="font-serif text-xl font-semibold">Reading History</h2>
      <p className="mt-1 text-[0.8125rem] text-muted-foreground">
        All your reading activity across books
      </p>

      {/* Filter tabs */}
      <div className="mt-4 flex items-center gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const Icon = f.icon;
          const active =
            statusFilter === f.value;
          return (
            <button
              key={f.label}
              onClick={() => setStatusFilter(f.value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="mt-4">
        {readings === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/40 bg-card/60 p-3">
                <div className="flex gap-3">
                  <div className="animate-shimmer h-14 w-10 rounded-md bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="animate-shimmer h-4 w-36 rounded-md bg-muted" />
                    <div className="animate-shimmer h-3 w-24 rounded-md bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : readings.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/60 px-6 py-10 text-center">
            <p className="text-[0.8125rem] text-muted-foreground">
              {statusFilter
                ? `No ${statusFilter} books`
                : "No reading history yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {readings.map((r) => {
              const statusIcon =
                r.status === "finished" ? (
                  <BookCheck className="h-3.5 w-3.5 text-emerald-500" />
                ) : r.status === "abandoned" ? (
                  <BookX className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                );

              return (
                <div
                  key={r._id}
                  className="rounded-xl border border-border/40 bg-card/60 p-3 transition-colors hover:bg-card/80"
                >
                  <div className="flex gap-3">
                    <Link href={`/book/${r.bookId}`} className="shrink-0">
                      {r.coverImage ? (
                        <img
                          src={r.coverImage}
                          alt={r.bookTitle}
                          className="h-14 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-10 items-center justify-center rounded-md bg-muted">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {statusIcon}
                        <Link
                          href={`/book/${r.bookId}`}
                          className="truncate font-medium text-[0.875rem] hover:underline"
                        >
                          {r.bookTitle}
                        </Link>
                      </div>
                      <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                        {r.bookAuthor}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-[0.75rem] text-muted-foreground">
                        <span>{r.percentComplete}% complete</span>
                        <span>
                          {r.currentPage}/{r.totalPages} pages
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReadingContent() {
  return (
    <>
      <CurrentlyReadingSection />
      <ReadingHistory />
    </>
  );
}

export default function CurrentlyReadingPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Progress</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Currently Reading
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Track your progress and see your reading history
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <Link
            href="/reading-goals"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            Goals
          </Link>
          <Link
            href="/reading-streaks"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            Streaks
          </Link>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <ReadingContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to track your reading progress." />
      </Unauthenticated>
    </main>
  );
}
