"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BookOpen, Clock } from "lucide-react";
import Link from "next/link";

function formatMonth(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function readingDays(start: number, end: number): number {
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

export function ProfileReadingTimeline({ userId }: { userId: Id<"users"> }) {
  const readings = useQuery(api.readingProgress.forUser, { userId });

  if (readings === undefined) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-shimmer h-16 rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (readings.length === 0) return null;

  // Group by month
  const grouped = new Map<string, typeof readings>();
  for (const r of readings) {
    const key = formatMonth(r.finishedAt);
    const group = grouped.get(key);
    if (group) {
      group.push(r);
    } else {
      grouped.set(key, [r]);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <h2 className="font-serif text-[1rem] font-semibold">
          Reading Timeline
        </h2>
        <span className="text-[0.75rem] text-muted-foreground">
          {readings.length} {readings.length === 1 ? "book" : "books"} finished
        </span>
      </div>

      <div className="relative space-y-5 pl-4 before:absolute before:left-[7px] before:top-1 before:h-[calc(100%-0.5rem)] before:w-px before:bg-border">
        {Array.from(grouped.entries()).map(([month, books]) => (
          <div key={month}>
            <div className="relative -ml-4 mb-2 flex items-center gap-2">
              <div className="h-[9px] w-[9px] rounded-full bg-primary" />
              <span className="text-[0.75rem] font-medium text-muted-foreground">
                {month}
              </span>
            </div>
            <div className="space-y-2">
              {books.map((r) => {
                const days = readingDays(r.startedAt, r.finishedAt);
                return (
                  <Link
                    key={r._id}
                    href={`/book/${r.bookId}`}
                    className="flex items-start gap-3 rounded-xl border border-border/40 bg-card/60 p-3 transition-colors hover:bg-muted/50"
                  >
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] font-medium">
                        {r.bookTitle}
                      </p>
                      <p className="text-[0.6875rem] text-muted-foreground">
                        {r.bookAuthor}
                      </p>
                      <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                        {formatDate(r.finishedAt)} · {r.totalPages} pages · {days} {days === 1 ? "day" : "days"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
