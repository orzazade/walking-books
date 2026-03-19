"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Rss,
  BookOpen,
  RotateCcw,
  Star,
  MapPin,
  Users,
} from "lucide-react";
import { SignInPrompt } from "@/components/sign-in-prompt";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

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
    api.activityFeed.feed,
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

  // Empty — no activity (likely no follows)
  if (feed.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-lg font-semibold">No activity yet</h2>
        <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
          Follow other readers to see their pickups, returns, and reviews here.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/search"
            className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
          >
            Find readers
          </Link>
        </div>
      </div>
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
            key={`${item.type}-${item.user._id}-${item.timestamp}-${i}`}
            className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
          >
            <div className="flex items-start gap-3">
              {/* User avatar */}
              <Link href={`/profile/${item.user._id}`} className="shrink-0">
                {item.user.avatarUrl ? (
                  <img
                    src={item.user.avatarUrl}
                    alt={item.user.name}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                    {item.user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </Link>

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
                    <Link
                      href={`/profile/${item.user._id}`}
                      className="font-medium hover:underline"
                    >
                      {item.user.name}
                    </Link>{" "}
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

export default function ActivityPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Social</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Activity Feed
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            See what the readers you follow are picking up, returning, and
            reviewing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <Link
            href="/leaderboard"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Users className="h-3.5 w-3.5" />
            Leaderboard
          </Link>
          <Link
            href="/search"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Find readers
          </Link>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <FeedContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see activity from readers you follow." />
      </Unauthenticated>
    </main>
  );
}
