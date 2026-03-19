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
  BarChart3,
  Share2,
} from "lucide-react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import { ActivityFeedItem, ActivityFeedSkeleton } from "@/components/activity-feed-item";

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
    return <ActivityFeedSkeleton />;
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
      {feed.map((item, i) => (
        <ActivityFeedItem
          key={`${item.type}-${item.timestamp}-${i}`}
          actor={item.reader ?? null}
          typeConfig={TYPE_CONFIG[item.type]}
          book={item.book}
          detail={item.detail}
          timestamp={item.timestamp}
        />
      ))}
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
