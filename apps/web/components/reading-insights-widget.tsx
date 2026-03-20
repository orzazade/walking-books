"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";

interface ReadingStatsData {
  totalBooksRead: number;
  avgDaysPerBook: number | null;
  uniqueLocationsVisited: number;
  currentlyReading: number;
  topGenres: Array<{ genre: string; count: number }>;
  monthlyActivity: Array<{ month: string; count: number }>;
}

export function ReadingInsightsWidget({ stats }: { stats: ReadingStatsData }) {
  if (stats.totalBooksRead === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
        <BarChart3 className="h-4.5 w-4.5 text-primary" />
        Reading Insights
      </h2>
      <div className="rounded-xl border border-border/40 bg-card/60 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className="text-[0.75rem] text-muted-foreground">
              Avg. reading speed
            </span>
            <p className="mt-0.5 font-serif text-lg font-semibold">
              {stats.avgDaysPerBook ?? "—"}{" "}
              <span className="text-[0.75rem] font-normal text-muted-foreground">
                days/book
              </span>
            </p>
          </div>
          <div>
            <span className="text-[0.75rem] text-muted-foreground">
              Locations visited
            </span>
            <p className="mt-0.5 font-serif text-lg font-semibold">
              {stats.uniqueLocationsVisited}
            </p>
          </div>
          <div>
            <span className="text-[0.75rem] text-muted-foreground">
              Currently reading
            </span>
            <p className="mt-0.5 font-serif text-lg font-semibold">
              {stats.currentlyReading}
            </p>
          </div>
        </div>

        {stats.topGenres.length > 0 && (
          <div className="mt-4 border-t border-border/40 pt-4">
            <span className="text-[0.75rem] text-muted-foreground">
              Top genres
            </span>
            <div className="mt-2 space-y-1.5">
              {stats.topGenres.map((g) => {
                const maxCount = stats.topGenres[0].count;
                const pct = Math.round((g.count / maxCount) * 100);
                return (
                  <div key={g.genre} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-[0.75rem]">
                      {g.genre}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-[0.6875rem] text-muted-foreground">
                      {g.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {stats.monthlyActivity.some((m) => m.count > 0) && (
          <div className="mt-4 border-t border-border/40 pt-4">
            <span className="text-[0.75rem] text-muted-foreground">
              Monthly activity (last 12 months)
            </span>
            <div className="mt-2 flex items-end gap-1">
              {stats.monthlyActivity.map((m) => {
                const maxCount = Math.max(
                  ...stats.monthlyActivity.map((x) => x.count),
                );
                const height =
                  maxCount > 0
                    ? Math.max(4, Math.round((m.count / maxCount) * 48))
                    : 4;
                return (
                  <div
                    key={m.month}
                    className="group relative flex flex-1 flex-col items-center"
                  >
                    <div
                      className="w-full rounded-sm bg-primary/40 transition-colors group-hover:bg-primary/70"
                      style={{ height: `${height}px` }}
                    />
                    <span className="mt-1 hidden text-[0.5rem] text-muted-foreground/60 sm:block">
                      {m.month.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-3 text-[0.75rem]">
          <Link
            href="/reading-stats"
            className="text-primary hover:underline"
          >
            Full stats
          </Link>
          <Link
            href="/reading-goals"
            className="text-primary hover:underline"
          >
            Reading goals
          </Link>
          <Link
            href="/reading-streaks"
            className="text-primary hover:underline"
          >
            Streaks
          </Link>
        </div>
      </div>
    </section>
  );
}
