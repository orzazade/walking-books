"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useQuery, useConvexAuth, Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { BookCard } from "@/components/book-card";
import { ArrowRight, BookOpen, Search, X, Users } from "lucide-react";

function SuggestedFollows() {
  const { isAuthenticated } = useConvexAuth();
  const suggestions = useQuery(
    api.suggestedFollows.forMe,
    isAuthenticated ? undefined : "skip",
  );

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
        <Users className="h-4.5 w-4.5 text-primary" />
        Readers with similar taste
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((user) => (
          <Link
            key={user._id}
            href={`/profile/${user._id}`}
            className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-3 transition-colors hover:bg-card/80"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-medium">
                {user.name}
              </p>
              <p className="text-[0.6875rem] text-muted-foreground">
                {user.sharedBooks} book{user.sharedBooks !== 1 ? "s" : ""} in
                common
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const QUICK_SEARCHES = [
  "Dune",
  "Orwell",
  "Atomic Habits",
  "Philosophy",
  "9780451524935",
] as const;

export default function SearchPage() {
  const [input, setInput] = useState("");
  const deferredQuery = useDeferredValue(input.trim());

  const results = useQuery(
    api.books.searchCatalog,
    deferredQuery ? { query: deferredQuery } : "skip",
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="section-kicker mb-3">Discover</div>
        <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
          Search Books
        </h1>
        <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
          Search by title, author, category, or ISBN
        </p>
      </div>

      {/* Search input */}
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="What are you looking for?"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="h-12 rounded-xl border-border/60 bg-card/80 pl-11 pr-11 text-[0.875rem] placeholder:text-muted-foreground/60 focus:border-primary/30 focus:bg-card"
        />
        {input && (
          <button
            type="button"
            onClick={() => setInput("")}
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Quick searches */}
      {!deferredQuery && (
        <div className="mb-8 flex flex-wrap gap-2">
          {QUICK_SEARCHES.map((query) => (
            <button
              key={query}
              type="button"
              onClick={() => setInput(query)}
              className="rounded-lg border border-border/50 bg-card/60 px-3.5 py-1.5 text-[0.8125rem] font-medium transition-all hover:border-border hover:bg-card"
            >
              {query}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {!deferredQuery ? (
        <>
          <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-lg font-semibold">
              Start typing to search
            </h2>
            <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
              Or{" "}
              <Link
                href="/browse"
                className="inline-flex items-center gap-1 font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
              >
                browse all books
                <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          </div>
          <Authenticated>
            <SuggestedFollows />
          </Authenticated>
        </>
      ) : results === undefined ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <div className="animate-shimmer mx-auto h-4 w-32 rounded-md bg-muted" />
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="font-serif text-lg font-semibold">No books found</h2>
          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
            Try a shorter query or search by ISBN.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 text-[0.8125rem] text-muted-foreground">
            {results.length} result{results.length === 1 ? "" : "s"} for
            &ldquo;{deferredQuery}&rdquo;
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((book) => (
              <BookCard key={book._id} book={book} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
