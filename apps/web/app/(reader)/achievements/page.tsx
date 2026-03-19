"use client";

import { useQuery, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { HeaderActionLink } from "@/components/header-action-link";
import { Trophy, Lock } from "lucide-react";
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_FALLBACK_ICON } from "@/lib/achievements";

function AchievementsContent() {
  const achievements = useQuery(api.achievements.myAchievements, {});

  if (achievements === undefined) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-card/60 p-4">
            <div className="flex items-center gap-3">
              <div className="animate-shimmer h-10 w-10 rounded-xl bg-muted" />
              <div className="space-y-1.5">
                <div className="animate-shimmer h-4 w-28 rounded-md bg-muted" />
                <div className="animate-shimmer h-3 w-40 rounded-md bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  return (
    <div>
      {/* Stats */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 px-4 py-2.5">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-[0.875rem] font-medium">
            {unlocked.length}/{achievements.length}
          </span>
          <span className="text-[0.8125rem] text-muted-foreground">unlocked</span>
        </div>
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-[0.8125rem] font-medium uppercase tracking-wider text-muted-foreground">
            Unlocked
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {unlocked.map((a) => {
              const Icon = ACHIEVEMENT_ICONS[a.key] ?? ACHIEVEMENT_FALLBACK_ICON;
              return (
                <div
                  key={a.key}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 transition-colors hover:bg-amber-500/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                      <Icon className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[0.875rem]">{a.name}</h3>
                      <p className="text-[0.75rem] text-muted-foreground">
                        {a.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <h2 className="mb-3 text-[0.8125rem] font-medium uppercase tracking-wider text-muted-foreground">
            Locked
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {locked.map((a) => (
                <div
                  key={a.key}
                  className="rounded-xl border border-border/40 bg-card/60 p-4 opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[0.875rem] text-muted-foreground">
                        {a.name}
                      </h3>
                      <p className="text-[0.75rem] text-muted-foreground">
                        {a.description}
                      </p>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* All unlocked */}
      {locked.length === 0 && unlocked.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-6 py-8 text-center">
          <Trophy className="mx-auto h-8 w-8 text-amber-500" />
          <h2 className="mt-2 font-serif text-lg font-semibold">
            All achievements unlocked!
          </h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            You&apos;ve earned every badge. Keep reading!
          </p>
        </div>
      )}
    </div>
  );
}

export default function AchievementsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Rewards</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Achievements
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Milestones earned through your reading journey
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <HeaderActionLink href="/reading-streaks">
            Streaks
          </HeaderActionLink>
          <HeaderActionLink href="/reading-goals">
            Goals
          </HeaderActionLink>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <AchievementsContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see your achievements." />
      </Unauthenticated>
    </main>
  );
}
