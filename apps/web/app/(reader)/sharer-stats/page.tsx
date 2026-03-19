"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import {
  Share2,
  BookOpen,
  Users,
  Clock,
  MapPin,
  Trophy,
  ArrowRight,
  Rss,
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
          <Link
            href="/sharer-activity"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Rss className="h-3.5 w-3.5" />
            Activity
          </Link>
          <Link
            href="/share"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share a Book
          </Link>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <StatsContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see your sharing stats." />
      </Unauthenticated>
    </main>
  );
}
