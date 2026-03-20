"use client";

import { useQuery, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { ReadingInsightsWidget } from "@/components/reading-insights-widget";
import { StreakGoalWidget } from "@/components/streak-goal-widget";
import { WishlistAlertsSection } from "@/components/wishlist-alerts-section";
import { WaitlistPreviewSection } from "@/components/waitlist-preview-section";
import { SharedCopiesSection } from "@/components/shared-copies-section";
import { ActiveReservationsSection } from "@/components/active-reservations-section";
import { HeldCopiesSection } from "@/components/held-copies-section";
import { FriendsReadingSection } from "@/components/friends-reading-section";
import { RecommendedBooksSection } from "@/components/recommended-books-section";
import { PendingRequestsSection } from "@/components/pending-requests-section";
import { TransferRequestsSection } from "@/components/transfer-requests-section";
import { FavoriteLocationsSection } from "@/components/favorite-locations-section";
import { NewArrivalsSection } from "@/components/new-arrivals-section";
import {
  BookOpen,
  Clock,
  Share2,
  Award,
} from "lucide-react";


function DashboardContent() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser, isAuthenticated ? {} : "skip");
  const readingStats = useQuery(api.readingStats.getStats, isAuthenticated ? {} : "skip");
  const heldCopies = useQuery(api.copies.byHolder, isAuthenticated ? {} : "skip");
  const activeReservations = useQuery(api.reservations.myActive, isAuthenticated ? {} : "skip");

  if (user === undefined) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
        <div className="animate-shimmer mx-auto h-4 w-32 rounded-md bg-muted" />
      </div>
    );
  }

  if (user === null) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        User not found. Please sign in again.
      </p>
    );
  }

  const repBadge =
    user.reputationScore >= 80
      ? { label: "Trusted", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" }
      : user.reputationScore >= 50
        ? { label: "Good Standing", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400" }
        : user.reputationScore >= 30
          ? { label: "Warning", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" }
          : { label: "Restricted", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400" };



  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            icon: Award,
            label: repBadge.label,
            value: user.reputationScore,
            badgeColor: repBadge.color,
          },
          { icon: BookOpen, label: "Read", value: user.booksRead },
          { icon: Share2, label: "Shared", value: user.booksShared },
          {
            icon: Clock,
            label: "Active",
            value: (heldCopies?.length ?? 0) + (activeReservations?.length ?? 0),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center rounded-xl border border-border/40 bg-card/60 p-4"
          >
            <stat.icon className="h-4.5 w-4.5 text-primary" />
            {"badgeColor" in stat ? (
              <span
                className={`mt-1.5 rounded-md px-2 py-0.5 text-[0.6875rem] font-medium ${stat.badgeColor}`}
              >
                {stat.label}
              </span>
            ) : (
              <span className="mt-1.5 text-[0.6875rem] text-muted-foreground">
                {stat.label}
              </span>
            )}
            <span className="mt-0.5 font-serif text-xl font-semibold">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Streak & Goal */}
      <StreakGoalWidget />

      {/* Reading Insights */}
      {readingStats && <ReadingInsightsWidget stats={readingStats} />}

      {/* Wishlist Alerts */}
      <WishlistAlertsSection />

      {/* Friends Reading */}
      <FriendsReadingSection />

      {/* New at Favorite Locations */}
      <NewArrivalsSection />

      {/* Recommended for You */}
      <RecommendedBooksSection />

      {/* Currently Reading */}
      <HeldCopiesSection />

      {/* Active Reservations */}
      <ActiveReservationsSection />

      {/* Pending Book Requests */}
      <PendingRequestsSection />

      {/* Transfer Requests */}
      <TransferRequestsSection />

      {/* Waiting For */}
      <WaitlistPreviewSection />

      {/* My Favorite Locations */}
      <FavoriteLocationsSection />

      {/* Books I've Shared */}
      <SharedCopiesSection />
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-8">
        <div className="section-kicker mb-3">Your Library</div>
        <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
          Dashboard
        </h1>
        <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
          Manage your books, reservations, and reading activity
        </p>
      </div>

      <Authenticated>
        <DashboardContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to access your dashboard." />
      </Unauthenticated>
    </main>
  );
}
