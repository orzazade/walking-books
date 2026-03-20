"use client";

import { useQuery, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  BarChart3,
  BookOpen,
  Clock,
  MapPin,
  Tag,
  Feather,
} from "lucide-react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { HeaderActionLink } from "@/components/header-action-link";

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: typeof BookOpen;
  iconColor: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-5">
      <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {label}
      </div>
      <div className="mt-2 font-serif text-[2rem] font-semibold leading-none tracking-tight">
        {value}
      </div>
      {subtitle && (
        <div className="mt-1 text-[0.75rem] text-muted-foreground">
          {subtitle}
        </div>
      )}
    </div>
  );
}

function GenreBar({ genre, count, max }: { genre: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-sm">{genre}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function MonthlyChart({
  data,
}: {
  data: Array<{ month: string; count: number }>;
}) {
  const maxCount = Math.max(...data.map((m) => m.count), 1);
  return (
    <div className="flex items-end gap-1">
      {data.map((m) => (
        <div
          key={m.month}
          className="group relative flex flex-1 flex-col items-center"
        >
          <span className="mb-1 hidden text-[0.625rem] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block">
            {m.count}
          </span>
          <div
            className="w-full rounded-sm bg-primary/40 transition-colors group-hover:bg-primary/70"
            style={{
              height: `${Math.max((m.count / maxCount) * 120, 2)}px`,
            }}
          />
          <span className="mt-1 hidden text-[0.5rem] text-muted-foreground/60 sm:block">
            {m.month.split(" ")[0]}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatsContent() {
  const { isAuthenticated } = useConvexAuth();
  const stats = useQuery(
    api.readingStats.getStats,
    isAuthenticated ? {} : "skip",
  );

  if (stats === undefined) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/40 bg-card/60 p-5"
            >
              <div className="animate-shimmer h-4 w-24 rounded-md bg-muted" />
              <div className="animate-shimmer mt-3 h-8 w-16 rounded-md bg-muted" />
              <div className="animate-shimmer mt-2 h-3 w-20 rounded-md bg-muted" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border/40 bg-card/60 p-5">
          <div className="animate-shimmer h-4 w-40 rounded-md bg-muted" />
          <div className="animate-shimmer mt-4 h-32 w-full rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  if (stats === null) return null;

  const hasData = stats.totalBooksRead > 0;

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <BarChart3 className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="font-serif text-[1.25rem] font-semibold">
          No reading stats yet
        </p>
        <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
          Pick up a book from a partner location to start building your stats.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Books Read"
          value={stats.totalBooksRead}
          icon={BookOpen}
          iconColor="text-primary"
          subtitle={`${stats.currentlyReading} in progress`}
        />
        <StatCard
          label="Pages Read"
          value={stats.totalPagesRead.toLocaleString()}
          icon={BookOpen}
          iconColor="text-amber-500"
          subtitle={stats.totalBooksRead > 0
            ? `~${Math.round(stats.totalPagesRead / stats.totalBooksRead)} per book`
            : undefined}
        />
        <StatCard
          label="Avg. Days per Book"
          value={stats.avgDaysPerBook ?? "—"}
          icon={Clock}
          iconColor="text-blue-500"
          subtitle="from pickup to return"
        />
        <StatCard
          label="Locations Visited"
          value={stats.uniqueLocationsVisited}
          icon={MapPin}
          iconColor="text-emerald-500"
          subtitle="partner locations"
        />
      </div>

      {/* Monthly activity chart */}
      {stats.monthlyActivity.some((m) => m.count > 0) && (
        <div className="rounded-xl border border-border/40 bg-card/60 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
            <BarChart3 className="h-4.5 w-4.5 text-primary" />
            Monthly Activity
          </h2>
          <MonthlyChart data={stats.monthlyActivity} />
          <p className="mt-2 text-[0.75rem] text-muted-foreground">
            Books completed per month over the last 12 months
          </p>
        </div>
      )}

      {/* Genre breakdown + Favorite authors */}
      <div className="grid gap-4 lg:grid-cols-2">
        {stats.topGenres.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-card/60 p-5">
            <h2 className="mb-4 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
              <Tag className="h-4.5 w-4.5 text-primary" />
              Top Genres
            </h2>
            <div className="space-y-2.5">
              {stats.topGenres.map((g) => (
                <GenreBar
                  key={g.genre}
                  genre={g.genre}
                  count={g.count}
                  max={stats.topGenres[0].count}
                />
              ))}
            </div>
          </div>
        )}

        {stats.favoriteAuthors.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-card/60 p-5">
            <h2 className="mb-4 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
              <Feather className="h-4.5 w-4.5 text-primary" />
              Favorite Authors
            </h2>
            <div className="space-y-2.5">
              {stats.favoriteAuthors.map((a) => (
                <GenreBar
                  key={a.author}
                  genre={a.author}
                  count={a.count}
                  max={stats.favoriteAuthors[0].count}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReadingStatsPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Insights</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Reading Stats
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Your reading life at a glance — genres, pace, and more
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <HeaderActionLink href="/reading-goals">
            <BookOpen className="h-3.5 w-3.5" />
            Goals
          </HeaderActionLink>
          <HeaderActionLink href="/reading-history">
            <Clock className="h-3.5 w-3.5" />
            History
          </HeaderActionLink>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <StatsContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see your reading statistics." />
      </Unauthenticated>
    </main>
  );
}
