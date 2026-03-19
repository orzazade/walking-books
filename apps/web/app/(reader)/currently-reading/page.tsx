"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { HeaderActionLink } from "@/components/header-action-link";
import { CurrentlyReadingSection } from "@/components/currently-reading-section";
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
          <HeaderActionLink href="/reading-goals">
            Goals
          </HeaderActionLink>
          <HeaderActionLink href="/reading-streaks">
            Streaks
          </HeaderActionLink>
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
