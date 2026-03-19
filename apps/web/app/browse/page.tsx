"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CategoryGrid } from "@/components/category-grid";
import { BookCard } from "@/components/book-card";
import { Suspense, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { HeaderActionLink } from "@/components/header-action-link";
import { BookOpen, Check, MapPin, X } from "lucide-react";
import {
  sortBooks,
  filterAvailableOnly,
  SORT_OPTIONS,
  SORT_LABELS,
  type SortOption,
} from "@/lib/browse-filters";

function LocationFilter({
  locationId,
  onSelect,
}: {
  locationId: Id<"partnerLocations"> | null;
  onSelect: (id: Id<"partnerLocations"> | null) => void;
}) {
  const locations = useQuery(api.partnerLocations.list);

  return (
    <div className="relative flex items-center gap-1.5">
      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={locationId ?? ""}
        onChange={(e) =>
          onSelect(
            e.target.value
              ? (e.target.value as Id<"partnerLocations">)
              : null,
          )
        }
        className={`appearance-none rounded-lg border py-1.5 pl-2 pr-7 text-[0.8125rem] font-medium outline-none transition-colors ${
          locationId
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border/50 bg-card/60 text-muted-foreground"
        }`}
        aria-label="Filter by location"
      >
        <option value="">All locations</option>
        {locations?.map((loc) => (
          <option key={loc._id} value={loc._id}>
            {loc.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function BrowseContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const [sortBy, setSortBy] = useState<SortOption>("availability");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [locationId, setLocationId] = useState<Id<"partnerLocations"> | null>(
    null,
  );

  // Data sources — pick based on active filters
  const filteredBooks = useQuery(
    api.books.byCategoryCatalog,
    category && !locationId ? { category } : "skip",
  );
  const allBooks = useQuery(
    api.books.listCatalog,
    !category && !locationId ? {} : "skip",
  );
  const locationBooks = useQuery(
    api.books.atLocationCatalog,
    locationId ? { locationId } : "skip",
  );

  const rawBooks = useMemo(() => {
    if (locationId) {
      if (!locationBooks) return undefined;
      // If category is also active, filter client-side
      if (category) {
        return locationBooks.filter((b) => b.categories.includes(category));
      }
      return locationBooks;
    }
    return category ? filteredBooks : allBooks;
  }, [locationId, locationBooks, category, filteredBooks, allBooks]);

  const books = useMemo(() => {
    if (!rawBooks) return undefined;
    const filtered = availableOnly ? filterAvailableOnly(rawBooks) : rawBooks;
    return sortBooks(filtered, sortBy);
  }, [rawBooks, sortBy, availableOnly]);

  const availableCopies =
    rawBooks?.reduce((sum, book) => sum + book.availableCopies, 0) ?? 0;

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
            {locationId
              ? "Showing books available at this location"
              : category
                ? `Showing books in ${category}`
                : "All books currently in the network"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            <span>{books ? books.length : "\u2026"} titles</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{rawBooks ? availableCopies : "\u2026"} available</span>
          </div>
          {category && (
            <HeaderActionLink href="/browse">
              <X className="h-3 w-3" />
              Clear filter
            </HeaderActionLink>
          )}
          {!category && locationId && (
            <button
              onClick={() => setLocationId(null)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <X className="h-3 w-3" />
              Clear location
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="mb-8">
        <CategoryGrid selectedCategory={category} />
      </div>

      {/* Sort & Filter controls */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[0.8125rem] text-muted-foreground">
          Sort:
        </span>
        {SORT_OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => setSortBy(option)}
            className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
              sortBy === option
                ? "bg-primary text-primary-foreground"
                : "border border-border/50 bg-card/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {SORT_LABELS[option]}
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-border/50" />
        <button
          onClick={() => setAvailableOnly((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
            availableOnly
              ? "bg-emerald-600 text-white"
              : "border border-border/50 bg-card/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {availableOnly && <Check className="h-3 w-3" />}
          Available Now
        </button>
        <div className="mx-1 h-5 w-px bg-border/50" />
        <LocationFilter locationId={locationId} onSelect={setLocationId} />
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
          message={
            locationId
              ? "No books are currently available at this location."
              : availableOnly
                ? "No books are currently available. Try removing the filter."
                : "Try a different category or search by title."
          }
        >
          <div className="mt-4 flex justify-center gap-3">
            {(availableOnly || locationId) && (
              <button
                onClick={() => {
                  setAvailableOnly(false);
                  setLocationId(null);
                }}
                className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
              >
                Clear filters
              </button>
            )}
            <Link
              href="/browse"
              className="rounded-lg border border-border px-4 py-2 text-[0.8125rem] font-medium"
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
