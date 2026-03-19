"use client";

import { useQuery, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HeaderActionLink } from "@/components/header-action-link";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { BookOpen, Calendar, Target, MapPin, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function HistoryContent() {
  const { isAuthenticated } = useConvexAuth();
  const history = useQuery(
    api.readingHistory.myHistory,
    isAuthenticated ? {} : "skip",
  );

  if (history === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-shimmer h-28 rounded-xl border border-border/40 bg-muted"
          />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-lg font-semibold">
          No reading history yet
        </h2>
        <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
          Once you borrow and return a book, it will appear here.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Browse books
        </Link>
      </div>
    );
  }

  const totalBooks = history.length;
  const totalDays = history.reduce((sum, h) => sum + h.daysHeld, 0);
  const avgDays = Math.round(totalDays / totalBooks);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
          <p className="font-serif text-[1.75rem] font-semibold leading-none">
            {totalBooks}
          </p>
          <p className="mt-1 text-[0.75rem] text-muted-foreground">
            Books read
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
          <p className="font-serif text-[1.75rem] font-semibold leading-none">
            {totalDays}
          </p>
          <p className="mt-1 text-[0.75rem] text-muted-foreground">
            Total days
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
          <p className="font-serif text-[1.75rem] font-semibold leading-none">
            {avgDays}
          </p>
          <p className="mt-1 text-[0.75rem] text-muted-foreground">
            Avg days/book
          </p>
        </div>
      </div>

      {/* History list */}
      <div className="space-y-2.5">
        {history.map((entry) => (
          <div
            key={entry._id}
            className="rounded-xl border border-border/40 bg-card/60 p-4"
          >
            <div className="flex gap-4">
              {/* Cover */}
              {entry.coverImage ? (
                <Link
                  href={entry.bookId ? `/book/${entry.bookId}` : "#"}
                  className="flex-shrink-0"
                >
                  <Image
                    src={entry.coverImage}
                    alt={entry.title}
                    width={56}
                    height={84}
                    className="rounded-md object-cover"
                  />
                </Link>
              ) : (
                <div className="flex h-[84px] w-[56px] flex-shrink-0 items-center justify-center rounded-md bg-muted">
                  <BookOpen className="h-5 w-5 text-muted-foreground/40" />
                </div>
              )}

              {/* Details */}
              <div className="min-w-0 flex-1">
                <Link
                  href={entry.bookId ? `/book/${entry.bookId}` : "#"}
                  className="font-serif text-[0.9375rem] font-semibold leading-tight hover:underline"
                >
                  {entry.title}
                </Link>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {entry.author}
                </p>

                {/* Meta row */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(entry.returnedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {entry.daysHeld} {entry.daysHeld === 1 ? "day" : "days"}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {entry.pickupLocation}
                  </span>
                </div>

                {/* Reader note */}
                {entry.readerNote && (
                  <p className="mt-2 text-[0.8125rem] italic leading-relaxed text-muted-foreground/80">
                    &ldquo;{entry.readerNote}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReadingHistoryPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Library</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Reading History
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Every book you&apos;ve borrowed and returned
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <HeaderActionLink href="/reading-goals">
            <Target className="h-3.5 w-3.5" />
            Goals
          </HeaderActionLink>
          <HeaderActionLink href="/reading-streaks">
            <Calendar className="h-3.5 w-3.5" />
            Streaks
          </HeaderActionLink>
          <HeaderActionLink href="/dashboard">
            <BookOpen className="h-3.5 w-3.5" />
            Dashboard
          </HeaderActionLink>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <HistoryContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to view your reading history." />
      </Unauthenticated>
    </main>
  );
}
