"use client";

import { useState } from "react";
import { useQuery, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HeaderActionLink } from "@/components/header-action-link";
import { EmptyState } from "@/components/empty-state";
import { SignInPrompt } from "@/components/sign-in-prompt";
import {
  Calendar,
  BookOpen,
  Clock,
  MapPin,
  Flame,
  Target,
  Zap,
  PenLine,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const CURRENT_YEAR = new Date().getFullYear();

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="font-serif text-[1.5rem] font-semibold leading-none">
        {value}
      </p>
      <p className="mt-1 text-[0.75rem] text-muted-foreground">{label}</p>
      {sub && (
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground/70">
          {sub}
        </p>
      )}
    </div>
  );
}

function MonthlyChart({
  data,
}: {
  data: { month: string; count: number }[];
}) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-5">
      <h2 className="mb-4 text-[0.875rem] font-medium">Monthly Activity</h2>
      <div className="flex items-end gap-1.5">
        {data.map((d) => (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[0.625rem] font-medium text-muted-foreground">
              {d.count || ""}
            </span>
            <div
              className="w-full rounded-t-sm bg-primary/20 transition-all duration-500"
              style={{
                height: `${Math.max((d.count / max) * 80, d.count > 0 ? 4 : 1)}px`,
                backgroundColor:
                  d.count > 0
                    ? `hsl(var(--primary) / ${0.3 + (d.count / max) * 0.7})`
                    : undefined,
              }}
            />
            <span className="text-[0.5625rem] text-muted-foreground">
              {d.month.slice(0, 3)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewContent({ year }: { year: number }) {
  const { isAuthenticated } = useConvexAuth();
  const review = useQuery(
    api.yearInReview.getReview,
    isAuthenticated ? { year } : "skip",
  );

  if (review === undefined) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="animate-shimmer h-28 rounded-xl bg-muted"
            />
          ))}
        </div>
        <div className="animate-shimmer h-32 rounded-xl bg-muted" />
      </div>
    );
  }

  if (review === null) return null;

  if (review.totalBooksRead === 0 && review.booksStarted === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title={`No reading activity in ${year}`}
        message={
          year === CURRENT_YEAR
            ? "Pick up a book from a partner location to start your reading journey!"
            : `You didn't complete any books in ${year}.`
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Key stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="Books completed"
          value={review.totalBooksRead}
          sub={
            review.booksStarted > review.totalBooksRead
              ? `${review.booksStarted} started`
              : undefined
          }
        />
        <StatCard
          icon={TrendingUp}
          label="Pages read"
          value={review.totalPagesRead.toLocaleString()}
        />
        <StatCard
          icon={Clock}
          label="Avg days per book"
          value={review.avgDaysPerBook ?? "-"}
        />
        <StatCard
          icon={MapPin}
          label="Locations visited"
          value={review.uniqueLocationsVisited}
        />
      </div>

      {/* Monthly chart */}
      {review.totalBooksRead > 0 && (
        <MonthlyChart data={review.monthlyActivity} />
      )}

      {/* Highlights row */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Top genres */}
        {review.topGenres.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-card/60 p-5">
            <h2 className="mb-3 text-[0.875rem] font-medium">Top Genres</h2>
            <div className="space-y-2">
              {review.topGenres.map((g, i) => (
                <div key={g.genre} className="flex items-center justify-between">
                  <span className="text-[0.8125rem]">
                    <span className="mr-2 text-muted-foreground">
                      {i + 1}.
                    </span>
                    {g.genre}
                  </span>
                  <span className="text-[0.75rem] text-muted-foreground">
                    {g.count} {g.count === 1 ? "book" : "books"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top locations */}
        {review.topLocations.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-card/60 p-5">
            <h2 className="mb-3 text-[0.875rem] font-medium">
              Favorite Locations
            </h2>
            <div className="space-y-2">
              {review.topLocations.map((l, i) => (
                <div key={l.name} className="flex items-center justify-between">
                  <span className="text-[0.8125rem]">
                    <span className="mr-2 text-muted-foreground">
                      {i + 1}.
                    </span>
                    {l.name}
                  </span>
                  <span className="text-[0.75rem] text-muted-foreground">
                    {l.count} {l.count === 1 ? "pickup" : "pickups"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {review.reviewsWritten > 0 && (
          <StatCard
            icon={PenLine}
            label="Reviews written"
            value={review.reviewsWritten}
            sub={
              review.avgRatingGiven
                ? `Avg rating: ${review.avgRatingGiven}`
                : undefined
            }
          />
        )}
        {review.longestStreak > 0 && (
          <StatCard
            icon={Flame}
            label="Longest streak"
            value={`${review.longestStreak}d`}
          />
        )}
        {review.goalTarget !== null && (
          <StatCard
            icon={Target}
            label="Reading goal"
            value={`${review.goalProgress}%`}
            sub={`${review.totalBooksRead} of ${review.goalTarget} books`}
          />
        )}
        {review.fastestRead && (
          <StatCard
            icon={Zap}
            label="Fastest read"
            value={`${review.fastestRead.days}d`}
            sub={review.fastestRead.title}
          />
        )}
      </div>

      {/* Most read author */}
      {review.mostReadAuthor && review.mostReadAuthor.count > 1 && (
        <div className="rounded-xl border border-border/40 bg-card/60 p-5">
          <h2 className="mb-1 text-[0.875rem] font-medium">
            Most Read Author
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            <span className="font-medium text-foreground">
              {review.mostReadAuthor.author}
            </span>{" "}
            — {review.mostReadAuthor.count} books
          </p>
        </div>
      )}
    </div>
  );
}

export default function YearInReviewPage() {
  const [year, setYear] = useState(CURRENT_YEAR);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Recap</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Year in Review
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Your reading journey through {year}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <HeaderActionLink href="/reading-goals">
            <Target className="h-3.5 w-3.5" />
            Goals
          </HeaderActionLink>
          <HeaderActionLink href="/reading-streaks">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            Streaks
          </HeaderActionLink>
        </div>
      </div>

      {/* Year selector */}
      <div className="mb-6 flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => setYear((y) => y - 1)}
          disabled={year <= 2020}
          aria-label="Previous year"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex items-center gap-1.5 text-[1rem] font-medium">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {year}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= CURRENT_YEAR}
          aria-label="Next year"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <Authenticated>
        <ReviewContent year={year} />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see your reading year in review." />
      </Unauthenticated>
    </main>
  );
}
