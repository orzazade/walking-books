"use client";

import { useQuery, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Flame, Trophy, Calendar, BookOpen } from "lucide-react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { HeaderActionLink } from "@/components/header-action-link";

function StreakCard({
  label,
  value,
  icon: Icon,
  iconColor,
  subtitle,
}: {
  label: string;
  value: number;
  icon: typeof Flame;
  iconColor: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-5">
      <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {label}
      </div>
      <div className="mt-2 font-serif text-[2.5rem] font-semibold leading-none tracking-tight">
        {value}
      </div>
      <div className="mt-1 text-[0.75rem] text-muted-foreground">
        {subtitle ?? (value === 1 ? "day" : "days")}
      </div>
    </div>
  );
}

function streakMessage(current: number): string {
  if (current === 0) return "Start a streak by reading today!";
  if (current < 3) return "Nice start! Keep going.";
  if (current < 7) return "Building momentum!";
  if (current < 14) return "A week-long reader — impressive!";
  if (current < 30) return "Two weeks strong!";
  if (current < 60) return "A whole month of reading!";
  return "Incredible dedication!";
}

function StreakContent() {
  const { isAuthenticated } = useConvexAuth();
  const streak = useQuery(
    api.readingStreaks.getStreak,
    isAuthenticated ? {} : "skip",
  );

  // Loading
  if (streak === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/40 bg-card/60 p-5"
          >
            <div className="animate-shimmer h-4 w-24 rounded-md bg-muted" />
            <div className="animate-shimmer mt-3 h-10 w-16 rounded-md bg-muted" />
            <div className="animate-shimmer mt-2 h-3 w-12 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  // Not logged in (shouldn't reach here due to Authenticated wrapper, but safe)
  if (streak === null) return null;

  const isActive = streak.currentStreak > 0;

  return (
    <div className="space-y-6">
      {/* Motivational banner */}
      <div
        className={`rounded-2xl border px-6 py-8 text-center ${
          isActive
            ? "border-orange-200/40 bg-gradient-to-b from-orange-50/50 to-transparent dark:border-orange-500/20 dark:from-orange-950/20"
            : "border-border/40 bg-card/60"
        }`}
      >
        <div
          className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${
            isActive ? "bg-orange-100 dark:bg-orange-500/20" : "bg-muted"
          }`}
        >
          <Flame
            className={`h-7 w-7 ${
              isActive
                ? "text-orange-500"
                : "text-muted-foreground"
            }`}
          />
        </div>
        <p className="font-serif text-[1.25rem] font-semibold">
          {streakMessage(streak.currentStreak)}
        </p>
        {streak.lastActiveDate && (
          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
            Last active: {streak.lastActiveDate}
          </p>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StreakCard
          label="Current Streak"
          value={streak.currentStreak}
          icon={Flame}
          iconColor={isActive ? "text-orange-500" : "text-muted-foreground"}
        />
        <StreakCard
          label="Longest Streak"
          value={streak.longestStreak}
          icon={Trophy}
          iconColor="text-yellow-500"
        />
        <StreakCard
          label="Last Active"
          value={streak.lastActiveDate ? 1 : 0}
          icon={Calendar}
          iconColor="text-blue-500"
          subtitle={streak.lastActiveDate ?? "No activity yet"}
        />
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-border/40 bg-card/60 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
          <BookOpen className="h-4.5 w-4.5 text-primary" />
          How streaks work
        </h2>
        <ul className="space-y-1.5 text-[0.8125rem] text-muted-foreground">
          <li>Update your reading progress to keep your streak alive.</li>
          <li>Your streak resets if you miss more than one day.</li>
          <li>Compete with other readers on the leaderboard!</li>
        </ul>
      </div>
    </div>
  );
}

export default function ReadingStreaksPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Progress</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Reading Streaks
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Track your daily reading habit and build a streak
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <HeaderActionLink href="/leaderboard">
            <Trophy className="h-3.5 w-3.5 text-yellow-500" />
            Leaderboard
          </HeaderActionLink>
          <HeaderActionLink href="/dashboard">
            <BookOpen className="h-3.5 w-3.5" />
            Dashboard
          </HeaderActionLink>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <StreakContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to track your reading streak." />
      </Unauthenticated>
    </main>
  );
}
