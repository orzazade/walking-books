"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  BookOpen,
  RotateCcw,
  Star,
  Users,
} from "lucide-react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import { ActivityFeedItem } from "@/components/activity-feed-item";

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
      <EmptyState
        icon={Users}
        title="No activity yet"
        message="Follow other readers to see their pickups, returns, and reviews here."
      >
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/search"
            className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
          >
            Find readers
          </Link>
        </div>
      </EmptyState>
    );
  }

  // Data
  return (
    <div className="space-y-2">
      {feed.map((item, i) => (
        <ActivityFeedItem
          key={`${item.type}-${item.user._id}-${item.timestamp}-${i}`}
          actor={item.user}
          typeConfig={TYPE_CONFIG[item.type]}
          book={item.book}
          detail={item.detail}
          timestamp={item.timestamp}
        />
      ))}
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
