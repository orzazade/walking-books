"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sparkles, Star, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function RecommendedBooksSection() {
  const { isAuthenticated } = useConvexAuth();
  const recs = useQuery(
    api.recommendations.forMe,
    isAuthenticated ? {} : "skip",
  );

  if (!recs || recs.length === 0) return null;

  // Show up to 6 on the dashboard — full list at /recommendations
  const displayed = recs.slice(0, 6);

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
          <Sparkles className="h-4.5 w-4.5 text-primary" />
          Recommended for You
        </h2>
        <Link
          href="/recommendations"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          See all
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {displayed.map((book) => (
          <Link
            key={book._id}
            href={`/book/${book._id}`}
            className="group flex w-[9rem] shrink-0 flex-col rounded-xl border border-border/40 bg-card/60 p-3 transition-colors hover:bg-card/80"
          >
            {/* Cover */}
            {book.coverImage ? (
              <img
                src={book.coverImage}
                alt={book.title}
                className="mx-auto h-32 w-[5.5rem] rounded-lg object-cover transition-transform group-hover:scale-[1.02]"
              />
            ) : (
              <div className="mx-auto flex h-32 w-[5.5rem] items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                No cover
              </div>
            )}

            {/* Details */}
            <div className="mt-2">
              <h3 className="line-clamp-2 text-[0.75rem] font-medium leading-tight">
                {book.title}
              </h3>
              <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">
                {book.author}
              </p>

              {/* Meta */}
              <div className="mt-1 flex items-center gap-1.5 text-[0.625rem] text-muted-foreground">
                {book.avgRating > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                    {book.avgRating.toFixed(1)}
                  </span>
                )}
                {book.availableCopies > 0 && (
                  <span className="flex items-center gap-0.5 text-emerald-600">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Available
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
