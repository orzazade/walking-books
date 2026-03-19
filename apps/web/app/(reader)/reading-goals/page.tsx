"use client";

import { useState } from "react";
import { useQuery, useMutation, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { HeaderActionLink } from "@/components/header-action-link";
import { Target, BookOpen, Flame, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { SignInPrompt } from "@/components/sign-in-prompt";

const CURRENT_YEAR = new Date().getFullYear();

function ProgressRing({
  percent,
  size = 120,
}: {
  percent: number;
  size?: number;
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/40"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-all duration-700"
      />
    </svg>
  );
}

function SetGoalForm({
  currentTarget,
  onDone,
}: {
  currentTarget: number | null;
  onDone: () => void;
}) {
  const setGoal = useMutation(api.readingGoals.setGoal);
  const [target, setTarget] = useState(
    currentTarget?.toString() ?? "12",
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(target, 10);
    if (!num || num < 1 || num > 1000) {
      toast.error("Target must be between 1 and 1000");
      return;
    }
    setSaving(true);
    try {
      await setGoal({ year: CURRENT_YEAR, targetBooks: num });
      toast.success(currentTarget ? "Goal updated" : "Goal set!");
      onDone();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to set goal"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex-1">
        <label className="mb-1 block text-[0.75rem] text-muted-foreground">
          Books to read in {CURRENT_YEAR}
        </label>
        <input
          type="number"
          min={1}
          max={1000}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <Button
        type="submit"
        disabled={saving}
        className="rounded-lg"
        size="sm"
      >
        {saving ? "Saving..." : currentTarget ? "Update" : "Set goal"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-lg"
        onClick={onDone}
      >
        Cancel
      </Button>
    </form>
  );
}

function GoalsContent() {
  const { isAuthenticated } = useConvexAuth();
  const progress = useQuery(
    api.readingGoals.getProgress,
    isAuthenticated ? { year: CURRENT_YEAR } : "skip",
  );
  const lastYearProgress = useQuery(
    api.readingGoals.getProgress,
    isAuthenticated ? { year: CURRENT_YEAR - 1 } : "skip",
  );
  const removeGoal = useMutation(api.readingGoals.removeGoal);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Loading
  if (progress === undefined) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border/40 bg-card/60 p-8">
          <div className="flex items-center justify-center">
            <div className="animate-shimmer h-[120px] w-[120px] rounded-full bg-muted" />
          </div>
          <div className="animate-shimmer mx-auto mt-4 h-4 w-32 rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  if (progress === null) return null;

  const hasGoal = progress.targetBooks !== null;

  async function handleRemove() {
    setRemoving(true);
    try {
      await removeGoal({ year: CURRENT_YEAR });
      toast.success("Goal removed");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to remove goal"));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Main progress card */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-8">
        {hasGoal && !editing ? (
          <div className="flex flex-col items-center">
            {/* Progress ring */}
            <div className="relative">
              <ProgressRing percent={progress.progressPercent ?? 0} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-serif text-[1.75rem] font-semibold leading-none">
                  {progress.progressPercent}%
                </span>
              </div>
            </div>

            <p className="mt-4 text-[1rem] font-medium">
              {progress.completedReads} of {progress.targetBooks} books
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">
              {progress.completedReads >= (progress.targetBooks ?? 0)
                ? "Goal completed! Amazing work!"
                : `${(progress.targetBooks ?? 0) - progress.completedReads} more to go in ${CURRENT_YEAR}`}
            </p>

            {/* Progress bar (mobile-friendly alternative) */}
            <div className="mt-4 w-full max-w-xs">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${progress.progressPercent ?? 0}%` }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setEditing(true)}
              >
                Update goal
              </Button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="rounded-lg p-2 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove goal"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : editing ? (
          <div>
            <h2 className="mb-4 font-serif text-[1.125rem] font-semibold">
              {hasGoal ? "Update your goal" : "Set a reading goal"}
            </h2>
            <SetGoalForm
              currentTarget={progress.targetBooks}
              onDone={() => setEditing(false)}
            />
          </div>
        ) : (
          /* No goal set */
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-lg font-semibold">
              No goal set for {CURRENT_YEAR}
            </h2>
            <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
              You&apos;ve completed {progress.completedReads}{" "}
              {progress.completedReads === 1 ? "book" : "books"} this year.
              Set a target to track your progress!
            </p>
            <Button
              className="mt-4 rounded-xl"
              onClick={() => setEditing(true)}
            >
              Set a goal
            </Button>
          </div>
        )}
      </div>

      {/* Last year summary */}
      {lastYearProgress && lastYearProgress.completedReads > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/60 p-5">
          <h2 className="mb-2 flex items-center gap-2 text-[0.875rem] font-medium">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            {CURRENT_YEAR - 1} Recap
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            You completed{" "}
            <span className="font-medium text-foreground">
              {lastYearProgress.completedReads}
            </span>{" "}
            {lastYearProgress.completedReads === 1 ? "book" : "books"}
            {lastYearProgress.targetBooks
              ? ` out of a ${lastYearProgress.targetBooks}-book goal`
              : ""}
            .
          </p>
        </div>
      )}
    </div>
  );
}

export default function ReadingGoalsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Progress</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Reading Goals
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Set a yearly reading target and track how you&apos;re doing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <HeaderActionLink href="/year-in-review">
            <Calendar className="h-3.5 w-3.5" />
            Year in Review
          </HeaderActionLink>
          <HeaderActionLink href="/reading-streaks">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            Streaks
          </HeaderActionLink>
          <HeaderActionLink href="/dashboard">
            <BookOpen className="h-3.5 w-3.5" />
            Dashboard
          </HeaderActionLink>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <GoalsContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to set reading goals and track your progress." />
      </Unauthenticated>
    </main>
  );
}
