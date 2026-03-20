"use client";

import Link from "next/link";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Flame, Target } from "lucide-react";

export function StreakGoalWidget() {
  const { isAuthenticated } = useConvexAuth();
  const streak = useQuery(
    api.readingStreaks.getStreak,
    isAuthenticated ? {} : "skip",
  );
  const currentYear = new Date().getFullYear();
  const goalProgress = useQuery(
    api.readingGoals.getProgress,
    isAuthenticated ? { year: currentYear } : "skip",
  );

  // Don't render until data is loaded
  if (streak === undefined || goalProgress === undefined) return null;

  // Don't render if user has no streak history and no goal set
  const hasStreak = streak && streak.currentStreak > 0;
  const hasLongestStreak = streak && streak.longestStreak > 0;
  const hasGoal = goalProgress && goalProgress.targetBooks !== null;
  const hasReads = goalProgress && goalProgress.completedReads > 0;

  if (!hasStreak && !hasLongestStreak && !hasGoal && !hasReads) return null;

  return (
    <section className="mt-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Reading Streak */}
        <Link
          href="/reading-streaks"
          className="group rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:border-border"
        >
          <div className="flex items-center gap-2">
            <Flame
              className={`h-4.5 w-4.5 ${hasStreak ? "text-orange-500" : "text-muted-foreground/50"}`}
            />
            <span className="text-[0.75rem] text-muted-foreground">
              Reading Streak
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-2xl font-semibold">
              {streak?.currentStreak ?? 0}
            </span>
            <span className="text-[0.75rem] text-muted-foreground">
              {(streak?.currentStreak ?? 0) === 1 ? "day" : "days"}
            </span>
          </div>
          {hasLongestStreak && streak.currentStreak < streak.longestStreak && (
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
              Best: {streak.longestStreak} days
            </p>
          )}
          {hasStreak && streak.currentStreak === streak.longestStreak && streak.currentStreak > 1 && (
            <p className="mt-1 text-[0.6875rem] font-medium text-primary">
              Personal best!
            </p>
          )}
        </Link>

        {/* Reading Goal */}
        <Link
          href="/reading-goals"
          className="group rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:border-border"
        >
          <div className="flex items-center gap-2">
            <Target
              className={`h-4.5 w-4.5 ${hasGoal ? "text-primary" : "text-muted-foreground/50"}`}
            />
            <span className="text-[0.75rem] text-muted-foreground">
              {currentYear} Reading Goal
            </span>
          </div>
          {hasGoal ? (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-serif text-2xl font-semibold">
                  {goalProgress.completedReads}
                </span>
                <span className="text-[0.75rem] text-muted-foreground">
                  of {goalProgress.targetBooks} books
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all duration-500"
                  style={{ width: `${goalProgress.progressPercent ?? 0}%` }}
                />
              </div>
              <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                {goalProgress.progressPercent ?? 0}% complete
              </p>
            </>
          ) : (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-serif text-2xl font-semibold">
                  {goalProgress?.completedReads ?? 0}
                </span>
                <span className="text-[0.75rem] text-muted-foreground">
                  {(goalProgress?.completedReads ?? 0) === 1
                    ? "book this year"
                    : "books this year"}
                </span>
              </div>
              <p className="mt-1 text-[0.6875rem] text-muted-foreground group-hover:text-primary">
                Set a reading goal &rarr;
              </p>
            </>
          )}
        </Link>
      </div>
    </section>
  );
}
