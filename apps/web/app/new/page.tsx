"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookCard } from "@/components/book-card";
import { EmptyState } from "@/components/empty-state";
import { Sparkles, BookOpen } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function NewArrivalsPage() {
  const books = useQuery(api.newArrivals.recent, {});

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Discover</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            New Arrivals
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Recently added books — fresh finds from the community
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            <span>{books ? books.length : "…"} new</span>
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
      {books === undefined ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <div className="animate-shimmer mx-auto h-4 w-32 rounded-md bg-muted" />
        </div>
      ) : books.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No books yet"
          message="Books will appear here as readers share them with the community."
        >
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/share"
              className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
            >
              Share a book
            </Link>
            <Link
              href="/search"
              className="rounded-lg border border-border px-4 py-2 text-[0.8125rem] font-medium"
            >
              Search
            </Link>
          </div>
        </EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book) => (
            <div key={book._id} className="relative">
              <BookCard book={book} />
              <div className="mt-[-0.5rem] flex justify-center pb-2">
                <Badge
                  variant="outline"
                  className="gap-1.5 border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300"
                >
                  <Sparkles className="h-3 w-3" />
                  Added {formatDate(book.addedAt)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
