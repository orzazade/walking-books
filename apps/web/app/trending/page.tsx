"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookCard } from "@/components/book-card";
import { Flame, BookOpen, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TrendingPage() {
  const trending = useQuery(api.trendingBooks.trending, {});

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Discover</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Trending Books
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Most picked up books in the community over the last 30 days
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            <span>{trending ? trending.length : "…"} trending</span>
          </div>
          <Link
            href="/browse"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Browse all
          </Link>
        </div>
      </div>

      {/* Content */}
      {trending === undefined ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <div className="animate-shimmer mx-auto h-4 w-32 rounded-md bg-muted" />
        </div>
      ) : trending.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="font-serif text-lg font-semibold">
            No trending books yet
          </h2>
          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
            Books will appear here once readers start picking them up.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/browse"
              className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
            >
              Browse books
            </Link>
            <Link
              href="/search"
              className="rounded-lg border border-border px-4 py-2 text-[0.8125rem] font-medium"
            >
              Search
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Ranked list with pickup counts */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {trending.map((book, index) => (
              <div key={book._id} className="relative">
                {/* Rank badge */}
                <div className="absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-md">
                  {index + 1}
                </div>
                <BookCard book={book} />
                {/* Pickup count overlay */}
                <div className="mt-[-0.5rem] flex justify-center pb-2">
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300"
                  >
                    <Flame className="h-3 w-3" />
                    {book.recentPickups} pickup{book.recentPickups !== 1 ? "s" : ""} this month
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
