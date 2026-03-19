"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { HeaderActionLink } from "@/components/header-action-link";
import { StatCard } from "@/components/stat-card";
import {
  BarChart3,
  BookOpen,
  Copy,
  MapPin,
  Star,
  Users,
  TrendingUp,
  ArrowRightLeft,
  Trophy,
  Tag,
} from "lucide-react";

export default function CommunityPage() {
  const stats = useQuery(api.communityStats.getStats, {});

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Platform</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Community Stats
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            See how our book-sharing community is growing and thriving
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <HeaderActionLink href="/trending">
            <TrendingUp className="h-3.5 w-3.5" />
            Trending
          </HeaderActionLink>
          <HeaderActionLink href="/leaderboard">
            <Trophy className="h-3.5 w-3.5" />
            Leaderboard
          </HeaderActionLink>
        </div>
      </div>

      {/* Content */}
      {stats === undefined ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <div className="animate-shimmer mx-auto h-4 w-32 rounded-md bg-muted" />
        </div>
      ) : stats.totalBooks === 0 &&
        stats.totalCopies === 0 &&
        stats.totalLocations === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No community data yet"
          message="Stats will appear here as books are shared and read."
        >
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/browse"
              className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
            >
              Browse books
            </Link>
            <Link
              href="/share"
              className="rounded-lg border border-border px-4 py-2 text-[0.8125rem] font-medium"
            >
              Share a book
            </Link>
          </div>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {/* Headline stats */}
          <section>
            <h2 className="mb-4 font-serif text-lg font-semibold">Overview</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard
                icon={BookOpen}
                label="Books Registered"
                value={stats.totalBooks}
              />
              <StatCard
                icon={Copy}
                label="Copies in Circulation"
                value={stats.totalCopies}
              />
              <StatCard
                icon={ArrowRightLeft}
                label="Completed Reads"
                value={stats.completedReads}
                iconClassName="text-green-600"
              />
              <StatCard
                icon={Star}
                label="Reviews Written"
                value={stats.totalReviews}
                iconClassName="text-amber-500"
              />
            </div>
          </section>

          {/* People & places */}
          <section>
            <h2 className="mb-4 font-serif text-lg font-semibold">
              People & Places
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard
                icon={Users}
                label="Unique Readers"
                value={stats.totalReaders}
                iconClassName="text-blue-600"
              />
              <StatCard
                icon={Users}
                label="Active Sharers"
                value={stats.totalSharers}
                iconClassName="text-purple-600"
              />
              <StatCard
                icon={MapPin}
                label="Partner Locations"
                value={stats.totalLocations}
                iconClassName="text-rose-500"
              />
              <StatCard
                icon={BookOpen}
                label="Available Now"
                value={stats.availableCopies}
                iconClassName="text-green-500"
              />
            </div>
          </section>

          {/* Recent activity */}
          <section>
            <h2 className="mb-4 font-serif text-lg font-semibold">
              Last 30 Days
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatCard
                icon={TrendingUp}
                label="Recent Pickups"
                value={stats.recentPickups}
                iconClassName="text-orange-500"
              />
              <StatCard
                icon={ArrowRightLeft}
                label="Recent Returns"
                value={stats.recentReturns}
                iconClassName="text-green-600"
              />
              <StatCard
                icon={BookOpen}
                label="Currently Out"
                value={stats.checkedOutCopies}
                iconClassName="text-blue-500"
              />
            </div>
          </section>

          {/* Highlights */}
          {(stats.topLocation || stats.topGenre) && (
            <section>
              <h2 className="mb-4 font-serif text-lg font-semibold">
                Highlights
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {stats.topLocation && (
                  <div className="rounded-2xl border border-border/50 bg-card p-5">
                    <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                      <MapPin className="h-4 w-4 text-rose-500" />
                      Most Active Location
                    </div>
                    <p className="mt-2 font-serif text-lg font-semibold">
                      {stats.topLocation.name}
                    </p>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      {stats.topLocation.address}
                    </p>
                    <p className="mt-1.5 text-[0.8125rem] font-medium text-primary">
                      {stats.topLocation.pickups} pickup
                      {stats.topLocation.pickups !== 1 ? "s" : ""} all time
                    </p>
                  </div>
                )}
                {stats.topGenre && (
                  <div className="rounded-2xl border border-border/50 bg-card p-5">
                    <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                      <Tag className="h-4 w-4 text-violet-500" />
                      Most Popular Genre
                    </div>
                    <p className="mt-2 font-serif text-lg font-semibold capitalize">
                      {stats.topGenre}
                    </p>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      The community&apos;s favorite category
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
