"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { BookOpen, Gauge, CalendarClock, AlertTriangle } from "lucide-react";

function formatEstimate(estimatedFinishDate: number): string {
  const date = new Date(estimatedFinishDate);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `${diffDays} days`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PaceIndicator({
  pagesPerDay,
  estimatedFinishDate,
  estimatedDaysLeft,
  onTrack,
  hasReturnDeadline,
}: {
  pagesPerDay: number;
  estimatedFinishDate: number | null;
  estimatedDaysLeft: number | null;
  onTrack: boolean | null;
  hasReturnDeadline: number | null;
}) {
  if (pagesPerDay === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground">
      <span className="flex items-center gap-1">
        <Gauge className="h-3 w-3" />
        {pagesPerDay} pg/day
      </span>
      {estimatedFinishDate && estimatedDaysLeft !== null && estimatedDaysLeft > 0 && (
        <span className="flex items-center gap-1">
          <CalendarClock className="h-3 w-3" />
          ~{formatEstimate(estimatedFinishDate)}
        </span>
      )}
      {onTrack === false && hasReturnDeadline && (
        <span className="flex items-center gap-1 font-medium text-amber-500">
          <AlertTriangle className="h-3 w-3" />
          May miss return date
        </span>
      )}
      {onTrack === true && hasReturnDeadline && (
        <span className="text-emerald-500">On track</span>
      )}
    </div>
  );
}

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

export function CurrentlyReadingSection() {
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

              {/* Reading pace */}
              <PaceIndicator
                pagesPerDay={item.pagesPerDay}
                estimatedFinishDate={item.estimatedFinishDate}
                estimatedDaysLeft={item.estimatedDaysLeft}
                onTrack={item.onTrack}
                hasReturnDeadline={item.hasReturnDeadline}
              />

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
