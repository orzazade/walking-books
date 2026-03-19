"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CategoryGrid } from "@/components/category-grid";
import { BookCard } from "@/components/book-card";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { HeaderActionLink } from "@/components/header-action-link";
import { BookOpen, MapPin, X } from "lucide-react";

function BrowseContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");

  const filteredBooks = useQuery(
    api.books.byCategoryCatalog,
    category ? { category } : "skip",
  );
  const allBooks = useQuery(api.books.listCatalog, category ? "skip" : {});

  const books = category ? filteredBooks : allBooks;
  const availableCopies =
    books?.reduce((sum, book) => sum + book.availableCopies, 0) ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Collection</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            {category ? category : "Browse Books"}
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            {category
              ? `Showing books in ${category}`
              : "All books currently in the network"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            <span>{books ? books.length : "…"} titles</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{books ? availableCopies : "…"} available</span>
          </div>
          {category && (
            <HeaderActionLink href="/browse">
              <X className="h-3 w-3" />
              Clear filter
            </HeaderActionLink>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="mb-8">
        <CategoryGrid selectedCategory={category} />
      </div>

      {/* Books grid */}
      {books === undefined ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <div className="animate-shimmer mx-auto h-4 w-32 rounded-md bg-muted" />
        </div>
      ) : books.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No books found"
          message="Try a different category or search by title."
        >
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/browse"
              className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
            >
              All books
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
            <BookCard key={book._id} book={book} />
          ))}
        </div>
      )}
    </main>
  );
}

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="animate-shimmer h-4 w-40 rounded-md bg-muted" />
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  );
}
