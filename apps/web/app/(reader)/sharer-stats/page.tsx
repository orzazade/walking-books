"use client";

import Link from "next/link";
import { useQuery, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import { HeaderActionLink } from "@/components/header-action-link";
import { Badge } from "@/components/ui/badge";
import {
  Share2,
  BookOpen,
  Users,
  Clock,
  MapPin,
  Trophy,
  ArrowRight,
  Rss,
  TrendingUp,
  CalendarDays,
} from "lucide-react";

function StatsContent() {
  const stats = useQuery(api.sharerStats.getStats, {});

  if (stats === undefined) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-card/60 p-4">
            <div className="animate-shimmer h-8 w-16 rounded-md bg-muted" />
            <div className="animate-shimmer mt-2 h-4 w-24 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (stats === null) return null;

  if (stats.totalCopiesShared === 0) {
    return (
      <EmptyState
        icon={Share2}
        title="No books shared yet"
        message="Share your first book and see your impact on the community here."
      >
        <Link
          href="/share"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
        >
          Share a book
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </EmptyState>
    );
  }

  const statCards = [
    {
      label: "Books Shared",
      value: stats.totalCopiesShared,
      icon: BookOpen,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Times Lent",
      value: stats.totalTimesLent,
      icon: Share2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Unique Readers",
      value: stats.uniqueReaders,
      icon: Users,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Currently Lent",
      value: stats.currentlyLent,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-xl border border-border/40 bg-card/60 p-4"
            >
              <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${s.bg}`}>
                <Icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-semibold">{s.value}</p>
              <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                {s.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Average lending days */}
      {stats.avgLendingDays !== null && (
        <div className="rounded-xl border border-border/40 bg-card/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[0.8125rem] text-muted-foreground">
                Average lending period
              </p>
              <p className="text-lg font-semibold">
                {stats.avgLendingDays} days
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Most popular book */}
      {stats.mostPopularBook && (
        <div className="rounded-xl border border-border/40 bg-card/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Trophy className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[0.75rem] text-muted-foreground">
                Most popular book
              </p>
              <p className="font-medium">{stats.mostPopularBook.title}</p>
              <p className="text-[0.75rem] text-muted-foreground">
                by {stats.mostPopularBook.author} &middot; lent{" "}
                {stats.mostPopularBook.timesLent} time
                {stats.mostPopularBook.timesLent !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top locations */}
      {stats.topLocations.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/60 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[0.875rem] font-medium">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Top Locations
          </h3>
          <div className="space-y-2">
            {stats.topLocations.map((loc, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
              >
                <span className="text-[0.8125rem]">{loc.name}</span>
                <span className="text-[0.75rem] font-medium text-muted-foreground">
                  {loc.count} {loc.count === 1 ? "book" : "books"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CONDITION_LABEL: Record<string, string> = {
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
};

const CONDITION_COLOR: Record<string, string> = {
  like_new: "text-emerald-500",
  good: "text-blue-500",
  fair: "text-amber-500",
  worn: "text-red-600",
};

function MonthlyActivitySection({
  data,
}: {
  data: { key: string; label: string; pickups: number; returns: number }[];
}) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map((m) => Math.max(m.pickups, m.returns)), 1);

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4">
      <h3 className="mb-4 flex items-center gap-2 text-[0.875rem] font-medium">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        Monthly Activity
      </h3>
      <div className="space-y-3">
        {data.map((m) => (
          <div key={m.key}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[0.75rem] text-muted-foreground">{m.label}</span>
              <span className="text-[0.75rem] text-muted-foreground">
                {m.pickups} pickup{m.pickups !== 1 ? "s" : ""} · {m.returns} return{m.returns !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex gap-1">
              <div
                className="h-2 rounded-full bg-primary/70 transition-all"
                style={{ width: `${(m.pickups / maxVal) * 100}%`, minWidth: m.pickups > 0 ? "4px" : "0" }}
                title={`${m.pickups} pickups`}
              />
              <div
                className="h-2 rounded-full bg-accent/70 transition-all"
                style={{ width: `${(m.returns / maxVal) * 100}%`, minWidth: m.returns > 0 ? "4px" : "0" }}
                title={`${m.returns} returns`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[0.6875rem] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-primary/70" /> Pickups
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-accent/70" /> Returns
        </span>
      </div>
    </div>
  );
}

function PerBookSection({
  books,
}: {
  books: {
    bookId: string;
    title: string;
    author: string;
    coverImage: string;
    copiesCount: number;
    timesLent: number;
    uniqueReaders: number;
    activeLends: number;
    avgReadingDays: number | null;
    totalReadingDays: number;
    bestCondition: string;
    worstCondition: string;
  }[];
}) {
  if (books.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4">
      <h3 className="mb-4 flex items-center gap-2 text-[0.875rem] font-medium">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        Your Books
      </h3>
      <div className="space-y-3">
        {books.map((book) => (
          <div
            key={book.bookId}
            className="flex gap-3 rounded-lg bg-muted/50 p-3"
          >
            {/* Cover thumbnail */}
            {book.coverImage ? (
              <img
                src={book.coverImage}
                alt=""
                className="h-16 w-11 flex-shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-16 w-11 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              {/* Title row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[0.8125rem] font-medium">{book.title}</p>
                  <p className="truncate text-[0.75rem] text-muted-foreground">
                    {book.author}
                  </p>
                </div>
                {book.activeLends > 0 && (
                  <Badge variant="outline" className="shrink-0 border-amber-500/30 text-amber-500">
                    {book.activeLends} out
                  </Badge>
                )}
              </div>

              {/* Metrics row */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Share2 className="h-3 w-3" />
                  {book.timesLent} lend{book.timesLent !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {book.uniqueReaders} reader{book.uniqueReaders !== 1 ? "s" : ""}
                </span>
                {book.totalReadingDays > 0 && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {book.totalReadingDays}d reading enabled
                  </span>
                )}
                {book.copiesCount > 1 && (
                  <span>{book.copiesCount} copies</span>
                )}
                <span className={CONDITION_COLOR[book.worstCondition] ?? "text-muted-foreground"}>
                  {CONDITION_LABEL[book.worstCondition] ?? book.worstCondition}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownContent() {
  const breakdown = useQuery(api.sharerStats.perBookBreakdown, {});

  if (breakdown === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-card/60 p-4">
            <div className="animate-shimmer h-6 w-32 rounded-md bg-muted" />
            <div className="animate-shimmer mt-3 h-16 w-full rounded-md bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (breakdown === null) return null;

  return (
    <>
      <MonthlyActivitySection data={breakdown.monthlyActivity} />
      <PerBookSection books={breakdown.books} />
    </>
  );
}

export default function SharerStatsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Sharing</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Sharer Stats
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Your impact on the community through book sharing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <HeaderActionLink href="/sharer-activity">
            <Rss className="h-3.5 w-3.5" />
            Activity
          </HeaderActionLink>
          <HeaderActionLink href="/share">
            <Share2 className="h-3.5 w-3.5" />
            Share a Book
          </HeaderActionLink>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <div className="space-y-6">
          <StatsContent />
          <BreakdownContent />
        </div>
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see your sharing stats." />
      </Unauthenticated>
    </main>
  );
}
