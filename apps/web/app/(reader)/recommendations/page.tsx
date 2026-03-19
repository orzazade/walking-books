"use client";

import Link from "next/link";
import { useQuery, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import {
  Sparkles,
  Star,
  BookOpen,
  CheckCircle2,
} from "lucide-react";

function RecommendationsContent() {
  const recs = useQuery(api.recommendations.forMe);

  if (recs === undefined) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-card/60 p-3">
            <div className="animate-shimmer mx-auto h-40 w-full rounded-lg bg-muted" />
            <div className="mt-2 space-y-1.5">
              <div className="animate-shimmer h-4 w-3/4 rounded-md bg-muted" />
              <div className="animate-shimmer h-3 w-1/2 rounded-md bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No recommendations yet"
        message="Read a few books and set your favorite genres in settings to get personalized recommendations."
      >
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/browse"
            className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
          >
            Browse books
          </Link>
          <Link
            href="/settings"
            className="rounded-lg border border-border bg-card px-4 py-2 text-[0.8125rem] font-medium"
          >
            Set genres
          </Link>
        </div>
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {recs.map((book) => (
        <Link
          key={book._id}
          href={`/book/${book._id}`}
          className="group rounded-xl border border-border/40 bg-card/60 p-3 transition-colors hover:bg-card/80"
        >
          {/* Cover */}
          {book.coverImage ? (
            <img
              src={book.coverImage}
              alt={book.title}
              className="mx-auto h-40 w-28 rounded-lg object-cover transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            <div className="mx-auto flex h-40 w-28 items-center justify-center rounded-lg bg-muted">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {/* Details */}
          <div className="mt-2.5">
            <h3 className="line-clamp-2 text-[0.8125rem] font-medium leading-tight">
              {book.title}
            </h3>
            <p className="mt-0.5 truncate text-[0.75rem] text-muted-foreground">
              {book.author}
            </p>

            {/* Meta row */}
            <div className="mt-1.5 flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
              {book.avgRating > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {book.avgRating.toFixed(1)}
                </span>
              )}
              {book.availableCopies > 0 ? (
                <span className="flex items-center gap-0.5 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Available
                </span>
              ) : (
                <span className="text-muted-foreground/60">Unavailable</span>
              )}
            </div>

            {/* Categories */}
            {book.categories.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {book.categories.slice(0, 2).map((cat) => (
                  <span
                    key={cat}
                    className="rounded-md bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function RecommendationsPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="section-kicker mb-3">For You</div>
        <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
          Recommendations
        </h1>
        <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
          Books picked for you based on your genres, reading history, and
          community activity
        </p>
      </div>

      {/* Content */}
      <Authenticated>
        <RecommendationsContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to get personalized book recommendations." />
      </Unauthenticated>
    </main>
  );
}
