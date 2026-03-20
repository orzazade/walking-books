"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { HeaderActionLink } from "@/components/header-action-link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tag, BookOpen, Search } from "lucide-react";

export default function CategoriesPage() {
  const categories = useQuery(api.books.allCategories, {});
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!categories) return undefined;
    if (!search.trim()) return categories;
    const q = search.trim().toLowerCase();
    return categories.filter((c) => c.category.toLowerCase().includes(q));
  }, [categories, search]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Discover</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Categories
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Browse books by genre and topic
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-muted-foreground">
            <Tag className="h-3.5 w-3.5 text-primary" />
            <span>{categories ? categories.length : "\u2026"} categories</span>
          </div>
          <HeaderActionLink href="/browse">
            <BookOpen className="h-3.5 w-3.5" />
            Browse all
          </HeaderActionLink>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search categories\u2026"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {filtered === undefined ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <div className="animate-shimmer mx-auto h-4 w-32 rounded-md bg-muted" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={search ? "No categories found" : "No categories yet"}
          message={
            search
              ? "Try a different search term."
              : "Categories will appear here once books are shared."
          }
        >
          {!search && (
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/share"
                className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
              >
                Share a book
              </Link>
            </div>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cat) => (
            <Link
              key={cat.category}
              href={`/categories/${encodeURIComponent(cat.category)}`}
              className="group flex gap-3 rounded-lg border border-border/50 bg-card p-3 transition-colors hover:border-border hover:bg-accent/5"
            >
              {/* Sample covers stack */}
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center">
                {cat.sampleCovers.length > 0 ? (
                  <div className="relative h-14 w-10">
                    {cat.sampleCovers.slice(0, 2).map((cover, i) => (
                      <img
                        key={i}
                        src={cover}
                        alt=""
                        className="absolute top-0 h-14 w-10 rounded-md border border-border/30 object-cover"
                        style={{
                          left: `${i * 6}px`,
                          zIndex: 2 - i,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-14 w-10 items-center justify-center rounded-md bg-muted">
                    <Tag className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                )}
              </div>

              {/* Category info */}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium group-hover:text-primary">
                  {cat.category}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {cat.bookCount} book{cat.bookCount !== 1 ? "s" : ""}
                  {cat.availableCount > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      {" "}&middot; {cat.availableCount} available
                    </span>
                  )}
                </p>
                {cat.topAuthors.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {cat.topAuthors.map((author) => (
                      <Badge
                        key={author}
                        variant="outline"
                        className="h-4 px-1.5 text-[0.5625rem]"
                      >
                        {author}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
