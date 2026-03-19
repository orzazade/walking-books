"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Trophy, BookOpen, Share2, Flame, Medal, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Tab = "readers" | "sharers" | "streaks";

const TABS: { key: Tab; label: string; icon: typeof Trophy }[] = [
  { key: "readers", label: "Top Readers", icon: BookOpen },
  { key: "sharers", label: "Top Sharers", icon: Share2 },
  { key: "streaks", label: "Longest Streaks", icon: Flame },
];

function rankIcon(index: number) {
  if (index === 0) return <Trophy className="h-4 w-4 text-yellow-500" />;
  if (index === 1) return <Medal className="h-4 w-4 text-gray-400" />;
  if (index === 2) return <Award className="h-4 w-4 text-amber-600" />;
  return null;
}

function LeaderboardEntry({
  rank,
  name,
  avatarUrl,
  stat,
  statLabel,
  secondaryStat,
  secondaryLabel,
}: {
  rank: number;
  name: string;
  avatarUrl?: string;
  stat: number;
  statLabel: string;
  secondaryStat?: number;
  secondaryLabel?: string;
}) {
  const isTop3 = rank <= 3;

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors",
        isTop3
          ? "border-primary/20 bg-primary/[0.03]"
          : "border-border/40 bg-card/60",
      )}
    >
      {/* Rank */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
        {rankIcon(rank - 1) ?? (
          <span className="text-sm font-medium text-muted-foreground">
            {rank}
          </span>
        )}
      </div>

      {/* Avatar + Name */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="truncate text-sm font-medium">{name}</span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        {secondaryStat !== undefined && secondaryLabel && (
          <div className="hidden text-right sm:block">
            <div className="text-xs text-muted-foreground">{secondaryLabel}</div>
            <div className="text-sm font-medium text-muted-foreground">
              {secondaryStat}
            </div>
          </div>
        )}
        <div className="text-right">
          <div className="text-xs text-muted-foreground">{statLabel}</div>
          <div className="text-sm font-semibold">{stat}</div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("readers");
  const topReaders = useQuery(api.leaderboard.topReaders, {});
  const topSharers = useQuery(api.leaderboard.topSharers, {});
  const topStreaks = useQuery(api.leaderboard.topStreaks, {});

  const isLoading =
    (tab === "readers" && topReaders === undefined) ||
    (tab === "sharers" && topSharers === undefined) ||
    (tab === "streaks" && topStreaks === undefined);

  const isEmpty =
    (tab === "readers" && topReaders?.length === 0) ||
    (tab === "sharers" && topSharers?.length === 0) ||
    (tab === "streaks" && topStreaks?.length === 0);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Community</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Leaderboard
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Top readers, sharers, and streaks over the last 30 days
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <Link
            href="/trending"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            Trending
          </Link>
          <Link
            href="/browse"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Browse all
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border/50 bg-muted/50 p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-[0.8125rem] font-medium transition-colors",
              tab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <div className="animate-shimmer mx-auto h-4 w-32 rounded-md bg-muted" />
        </div>
      ) : isEmpty ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Trophy className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="font-serif text-lg font-semibold">
            No rankings yet
          </h2>
          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
            Start reading and sharing books to appear on the leaderboard.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/browse"
              className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
            >
              Browse books
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {tab === "readers" &&
            topReaders?.map((reader, i) => (
              <LeaderboardEntry
                key={reader.userId}
                rank={i + 1}
                name={reader.name}
                avatarUrl={reader.avatarUrl}
                stat={reader.completedReads}
                statLabel="this month"
                secondaryStat={reader.booksRead}
                secondaryLabel="all time"
              />
            ))}

          {tab === "sharers" &&
            topSharers?.map((sharer, i) => (
              <LeaderboardEntry
                key={sharer.userId}
                rank={i + 1}
                name={sharer.name}
                avatarUrl={sharer.avatarUrl}
                stat={sharer.booksLent}
                statLabel="lent this month"
                secondaryStat={sharer.booksShared}
                secondaryLabel="total shared"
              />
            ))}

          {tab === "streaks" &&
            topStreaks?.map((streak, i) => (
              <LeaderboardEntry
                key={streak.userId}
                rank={i + 1}
                name={streak.name}
                avatarUrl={streak.avatarUrl}
                stat={streak.currentStreak}
                statLabel={`day${streak.currentStreak !== 1 ? "s" : ""} current`}
                secondaryStat={streak.longestStreak}
                secondaryLabel="best"
              />
            ))}
        </div>
      )}

      {/* Footer note */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Rankings based on activity in the last 30 days. Updated in real time.
      </p>
    </main>
  );
}
