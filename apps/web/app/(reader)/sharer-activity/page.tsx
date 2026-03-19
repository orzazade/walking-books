"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  BookOpen,
  RotateCcw,
  Star,
  AlertTriangle,
  MapPin,
  BarChart3,
  Share2,
} from "lucide-react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import { timeAgo } from "@/lib/utils";

const TYPE_CONFIG = {
  pickup: {
    icon: BookOpen,
    verb: "picked up",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  return: {
    icon: RotateCcw,
    verb: "returned",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  condition_report: {
    icon: AlertTriangle,
    verb: "reported condition on",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  review: {
    icon: Star,
    verb: "reviewed",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
} as const;

function FeedContent() {
  const { isAuthenticated } = useConvexAuth();
  const feed = useQuery(
    api.sharerActivity.feed,
    isAuthenticated ? { limit: 50 } : "skip",
  );

  // Loading
  if (feed === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/40 bg-card/60 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="animate-shimmer h-9 w-9 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="animate-shimmer h-4 w-48 rounded-md bg-muted" />
                <div className="animate-shimmer h-3 w-32 rounded-md bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty — no activity (no shared books or no interactions yet)
  if (feed.length === 0) {
    return (
      <EmptyState
        icon={Share2}
        title="No activity yet"
        message="Share books with the community and see pickups, returns, and reviews here."
      >
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/share"
            className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
          >
            Share a book
          </Link>
        </div>
      </EmptyState>
    );
  }

  // Data
  return (
    <div className="space-y-2">
      {feed.map((item, i) => {
        const config = TYPE_CONFIG[item.type];
        const Icon = config.icon;

        return (
          <div
            key={`${item.type}-${item.timestamp}-${i}`}
            className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
          >
            <div className="flex items-start gap-3">
              {/* Reader avatar */}
              {item.reader ? (
                <Link href={`/profile/${item.reader._id}`} className="shrink-0">
                  {item.reader.avatarUrl ? (
                    <img
                      src={item.reader.avatarUrl}
                      alt={item.reader.name}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                      {item.reader.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Link>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
                  ?
                </div>
              )}

              {/* Content */}
              <div className="min-w-0 flex-1">
                {/* Action line */}
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-md ${config.bgColor}`}
                  >
                    <Icon className={`h-3 w-3 ${config.color}`} />
                  </div>
                  <p className="text-[0.8125rem]">
                    {item.reader ? (
                      <Link
                        href={`/profile/${item.reader._id}`}
                        className="font-medium hover:underline"
                      >
                        {item.reader.name}
                      </Link>
                    ) : (
                      <span className="font-medium">Someone</span>
                    )}{" "}
                    <span className="text-muted-foreground">
                      {config.verb}
                    </span>{" "}
                    <Link
                      href={`/book/${item.book._id}`}
                      className="font-medium hover:underline"
                    >
                      {item.book.title}
                    </Link>
                  </p>
                </div>

                {/* Book author */}
                <p className="mt-0.5 pl-7 text-[0.75rem] text-muted-foreground">
                  by {item.book.author}
                </p>

                {/* Location (for pickup/return) */}
                {item.detail.locationName && (
                  <p className="mt-1 flex items-center gap-1 pl-7 text-[0.75rem] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {item.detail.locationName}
                  </p>
                )}

                {/* Condition report details */}
                {item.type === "condition_report" && item.detail.previousCondition && item.detail.newCondition && (
                  <p className="mt-1 pl-7 text-[0.75rem] text-muted-foreground">
                    {item.detail.previousCondition} → {item.detail.newCondition}
                  </p>
                )}

                {/* Review details */}
                {item.type === "review" && (
                  <div className="mt-1.5 pl-7">
                    {item.detail.rating !== undefined && (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star
                            key={s}
                            className={`h-3 w-3 ${
                              s < item.detail.rating!
                                ? "fill-amber-500 text-amber-500"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    {item.detail.reviewText && (
                      <p className="mt-1 line-clamp-2 text-[0.8125rem] text-muted-foreground">
                        &ldquo;{item.detail.reviewText}&rdquo;
                      </p>
                    )}
                  </div>
                )}

                {/* Timestamp */}
                <p className="mt-1.5 pl-7 text-[0.6875rem] text-muted-foreground/60">
                  {timeAgo(item.timestamp)}
                </p>
              </div>

              {/* Book cover thumbnail */}
              {item.book.coverImage && (
                <Link
                  href={`/book/${item.book._id}`}
                  className="hidden shrink-0 sm:block"
                >
                  <img
                    src={item.book.coverImage}
                    alt={item.book.title}
                    className="h-16 w-11 rounded-md object-cover"
                  />
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SharerActivityPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Sharing</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Sharer Activity
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            See who&apos;s picking up, returning, and reviewing your shared
            books
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <Link
            href="/sharer-stats"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Sharer Stats
          </Link>
          <Link
            href="/share"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share a Book
          </Link>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <FeedContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see activity on your shared books." />
      </Unauthenticated>
    </main>
  );
}
