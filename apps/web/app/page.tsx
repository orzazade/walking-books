"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { BookCard } from "@/components/book-card";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BookOpen,
  MapPin,
  Search,
  Share2,
} from "lucide-react";

const STEPS = [
  {
    number: "01",
    title: "Share a book",
    description:
      "Register your book, choose a partner cafe, and drop it off. It enters the network for others to discover.",
    icon: Share2,
  },
  {
    number: "02",
    title: "Reserve a copy",
    description:
      "Browse or search the collection. When you find something, reserve it for one hour — it will be waiting.",
    icon: Search,
  },
  {
    number: "03",
    title: "Pick up & return",
    description:
      "Collect your book from the cafe. When you are done, return it to any partner location in the network.",
    icon: MapPin,
  },
] as const;

export default function Home() {
  const featuredBooks = useQuery(api.books.featuredCatalog, {});
  const locations = useQuery(api.partnerLocations.list, {});

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* ── Hero ──────────────────────────────────── */}
      <section className="animate-fade-in-up grid items-center gap-10 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <div>
          <div className="section-kicker mb-6">Community Book Sharing</div>

          <h1 className="max-w-xl font-serif text-[2.75rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[3.5rem]">
            Books were meant
            <br />
            <span className="italic text-primary">to travel.</span>
          </h1>

          <p className="mt-5 max-w-lg text-[0.9375rem] leading-relaxed text-muted-foreground">
            A community network where your favorite reads move between readers
            through neighborhood cafes. Discover something new, share what you
            have loved.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/browse"
              className={cn(
                buttonVariants({ size: "lg" }),
                "gap-2 rounded-xl px-6 text-[0.8125rem] font-semibold",
              )}
            >
              Explore the collection
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/share"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "gap-2 rounded-xl px-6 text-[0.8125rem] font-semibold",
              )}
            >
              Share a book
            </Link>
          </div>

          <div className="mt-8 flex gap-6 text-[0.8125rem]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/8">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
              </div>
              <span>
                <strong className="font-semibold text-foreground">
                  {featuredBooks ? featuredBooks.length : "…"}
                </strong>{" "}
                titles
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/8">
                <MapPin className="h-3.5 w-3.5 text-accent" />
              </div>
              <span>
                <strong className="font-semibold text-foreground">
                  {locations ? locations.length : "…"}
                </strong>{" "}
                locations
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions card */}
        <div className="animate-fade-in-up delay-200 flex justify-center lg:justify-end">
          <div className="w-full max-w-sm rounded-2xl border border-border/50 bg-card/80 p-6 backdrop-blur-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 ring-1 ring-primary/15">
                <Image
                  src="/logo.svg"
                  alt="Walking Books"
                  width={24}
                  height={14}
                  priority
                />
              </div>
              <div>
                <h2 className="font-serif text-[1.0625rem] font-semibold">
                  Start reading
                </h2>
                <p className="text-[0.75rem] text-muted-foreground">
                  Choose your path into the collection
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Link href="/search" className="quick-action-link">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-[0.8125rem] font-medium">
                      Search by title
                    </div>
                    <div className="text-[0.6875rem] text-muted-foreground">
                      Find a specific book or author
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              </Link>

              <Link href="/browse" className="quick-action-link">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-[0.8125rem] font-medium">
                      Browse categories
                    </div>
                    <div className="text-[0.6875rem] text-muted-foreground">
                      Explore what is available now
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              </Link>

              <Link href="/locations" className="quick-action-link">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-[0.8125rem] font-medium">
                      Find a cafe
                    </div>
                    <div className="text-[0.6875rem] text-muted-foreground">
                      See nearby partner locations
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ───────────────────────────────── */}
      <div className="editorial-divider my-14">
        <div className="botanical-ornament" />
      </div>

      {/* ── How it works ──────────────────────────── */}
      <section className="animate-fade-in-up delay-300">
        <div className="mb-8">
          <div className="section-kicker mb-3">The Journey</div>
          <h2 className="font-serif text-[1.75rem] font-semibold tracking-[-0.01em]">
            How it works
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.title}
              className="group relative rounded-2xl border border-border/40 bg-card/60 p-6 transition-colors hover:border-border hover:bg-card"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="chapter-number">{step.number}</div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors group-hover:bg-primary/12">
                  <step.icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <h3 className="font-serif text-[1.0625rem] font-semibold">
                {step.title}
              </h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ───────────────────────────────── */}
      <div className="editorial-divider my-14">
        <div className="botanical-ornament" />
      </div>

      {/* ── Available now ─────────────────────────── */}
      <section className="animate-fade-in-up delay-400">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="section-kicker mb-3">Available Now</div>
            <h2 className="font-serif text-[1.75rem] font-semibold tracking-[-0.01em]">
              Books in the network
            </h2>
            <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
              Copies currently waiting at partner locations
            </p>
          </div>
          <Link
            href="/browse"
            className="hidden items-center gap-1.5 text-[0.8125rem] font-medium text-foreground transition-colors hover:text-primary sm:flex"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {featuredBooks === undefined ? (
          <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
            <div className="animate-shimmer mx-auto h-4 w-32 rounded-md bg-muted" />
          </div>
        ) : featuredBooks.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-lg font-semibold">
              No books available yet
            </h3>
            <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
              Be the first to share a book and start the network.
            </p>
            <Link
              href="/share"
              className={cn(
                buttonVariants({ size: "sm" }),
                "mt-4 rounded-lg px-4 text-[0.8125rem]",
              )}
            >
              Share a book
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredBooks.slice(0, 4).map((book) => (
              <BookCard key={book._id} book={book} />
            ))}
          </div>
        )}

        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/browse"
            className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-foreground"
          >
            View all books
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────── */}
      <section className="mt-16 rounded-2xl border border-border/40 bg-card/60 px-6 py-10 text-center sm:px-10">
        <div className="mx-auto max-w-md">
          <h2 className="font-serif text-[1.5rem] font-semibold tracking-[-0.01em]">
            Ready to join the community?
          </h2>
          <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground">
            Browse what is available or add your first book to the network.
            Every book shared is a story continued.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/browse"
              className={cn(
                buttonVariants({ size: "lg" }),
                "gap-2 rounded-xl px-6 text-[0.8125rem] font-semibold",
              )}
            >
              <BookOpen className="h-4 w-4" />
              Browse
            </Link>
            <Link
              href="/share"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "gap-2 rounded-xl px-6 text-[0.8125rem] font-semibold",
              )}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
