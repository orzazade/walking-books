"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookCard } from "@/components/book-card";
import { EmptyState } from "@/components/empty-state";
import { HeaderActionLink } from "@/components/header-action-link";
import { Badge } from "@/components/ui/badge";
import { Feather, BookOpen, ArrowLeft } from "lucide-react";

export default function AuthorDetailPage() {
  const params = useParams<{ name: string }>();
  const authorName = decodeURIComponent(params.name);

  const books = useQuery(api.books.byAuthorName, { author: authorName });

  const availableCount = books?.filter((b) => b.availableCopies > 0).length ?? 0;
  const totalCopies = books?.reduce((sum, b) => sum + b.totalCopies, 0) ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* Back link */}
      <Link
        href="/authors"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All authors
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Author</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            {authorName}
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            {books
              ? `${books.length} book${books.length !== 1 ? "s" : ""} in the community`
              : "Loading…"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          {books && books.length > 0 && (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <span>{totalCopies} copies</span>
              </div>
              {availableCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                >
                  {availableCount} available now
                </Badge>
              )}
            </>
          )}
          <HeaderActionLink href="/authors">
            <Feather className="h-3.5 w-3.5" />
            All authors
          </HeaderActionLink>
        </div>
      </div>

      {/* Content */}
      {books === undefined ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <div className="animate-shimmer mx-auto h-4 w-32 rounded-md bg-muted" />
        </div>
      ) : books.length === 0 ? (
        <EmptyState
          icon={Feather}
          title="No books found"
          message={`No books by "${authorName}" are currently in the community.`}
        >
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/authors"
              className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
            >
              Browse authors
            </Link>
            <Link
              href="/share"
              className="rounded-lg border border-border px-4 py-2 text-[0.8125rem] font-medium"
            >
              Share a book
            </Link>
          </div>
        </EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book) => (
            <BookCard key={book._id} book={book} />
          ))}
        </div>
      )}
    </main>
  );
}
