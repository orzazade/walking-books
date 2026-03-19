"use client";

import { useQuery, useMutation, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { type CopyStatus, CONDITION_LABELS, COPY_STATUS_LABELS, type Condition } from "@/convex/lib/validators";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { ReturnDialog } from "@/components/return-dialog";
import { getErrorMessage, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReservationTimer } from "@/components/reservation-timer";
import { ReadingInsightsWidget } from "@/components/reading-insights-widget";
import { WishlistAlertsSection } from "@/components/wishlist-alerts-section";
import { WaitlistPreviewSection } from "@/components/waitlist-preview-section";
import {
  BookOpen,
  Clock,
  Share2,
  RotateCcw,
  Award,
  ArrowUpRight,
  X,
  PackageCheck,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";


function DashboardContent() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser, isAuthenticated ? {} : "skip");
  const readingStats = useQuery(api.readingStats.getStats, isAuthenticated ? {} : "skip");
  const heldCopies = useQuery(api.copies.byHolder, isAuthenticated ? {} : "skip");
  const activeReservations = useQuery(api.reservations.active, isAuthenticated ? {} : "skip");
  const sharedCopies = useQuery(api.copies.bySharer, isAuthenticated ? {} : "skip");

  const extendCopy = useMutation(api.copies.extend);
  const cancelReservation = useMutation(api.reservations.cancel);
  const recallCopy = useMutation(api.copies.recall);
  const pickupCopy = useMutation(api.copies.pickup);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [returnCopyId, setReturnCopyId] = useState<Id<"copies"> | null>(null);

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

  async function handleAction(id: string, fn: () => Promise<unknown>) {
    setActionLoading(id);
    try {
      await fn();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePickup(
    copyId: Id<"copies">,
    locationId: Id<"partnerLocations">,
    reservationId?: Id<"reservations">,
  ) {
    await handleAction(`pickup-${copyId}`, async () => {
      await pickupCopy({
        copyId,
        locationId,
        reservationId,
        conditionAtPickup: "good",
        photos: [],
      });
      toast.success(
        "Book picked up! Check your Currently Reading section for the return deadline.",
      );
    });
  }



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

      {/* Reading Insights */}
      {readingStats && <ReadingInsightsWidget stats={readingStats} />}

      {/* Wishlist Alerts */}
      <WishlistAlertsSection />

      {/* Currently Reading */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
          <BookOpen className="h-4.5 w-4.5 text-primary" />
          Currently Reading
        </h2>
        {heldCopies === undefined ? (
          <div className="animate-shimmer h-4 w-40 rounded-md bg-muted" />
        ) : heldCopies.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/60 p-5 text-center text-[0.8125rem] text-muted-foreground">
            You don&apos;t have any books checked out.{" "}
            <Link href="/browse" className="font-medium text-primary underline underline-offset-2">
              Browse books
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {heldCopies.map((copy) => (
              <div
                key={copy._id}
                className="book-spine flex flex-col gap-3 rounded-xl border border-border/40 bg-card/60 p-4 pl-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/copy/${copy._id}`}
                    className="text-[0.875rem] font-medium hover:underline"
                  >
                    Copy #{copy._id.slice(-6)}
                  </Link>
                  {copy.returnDeadline && (
                    <p className="text-[0.75rem] text-muted-foreground">
                      Due:{" "}
                      {formatDate(copy.returnDeadline)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[0.6875rem]">
                    {CONDITION_LABELS[copy.condition as Condition]}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg text-[0.75rem]"
                    disabled={actionLoading === copy._id}
                    onClick={() =>
                      handleAction(copy._id, async () => {
                        await extendCopy({ copyId: copy._id });
                        toast.success("Lending period extended!");
                      })
                    }
                  >
                    <ArrowUpRight className="mr-1 h-3 w-3" /> Extend
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 rounded-lg text-[0.75rem]"
                    onClick={() => setReturnCopyId(copy._id)}
                  >
                    <Undo2 className="mr-1 h-3 w-3" /> Return
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Reservations */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
          <Clock className="h-4.5 w-4.5 text-primary" />
          Active Reservations
        </h2>
        {activeReservations === undefined ? (
          <div className="animate-shimmer h-4 w-40 rounded-md bg-muted" />
        ) : activeReservations.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/60 p-5 text-center text-[0.8125rem] text-muted-foreground">
            No active reservations.
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeReservations.map((res) => (
              <div
                key={res._id}
                className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/copy/${res.copyId}`}
                    className="text-[0.875rem] font-medium hover:underline"
                  >
                    Copy #{res.copyId.slice(-6)}
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[0.75rem] text-muted-foreground">
                      Expires in:
                    </span>
                    <ReservationTimer expiresAt={res.expiresAt} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="h-7 rounded-lg text-[0.75rem]"
                    disabled={actionLoading === `pickup-${res.copyId}`}
                    onClick={() =>
                      handlePickup(res.copyId, res.locationId, res._id)
                    }
                  >
                    <PackageCheck className="mr-1 h-3 w-3" /> Pick Up
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg text-[0.75rem]"
                    disabled={actionLoading === res._id}
                    onClick={() =>
                      handleAction(res._id, async () => {
                        await cancelReservation({ reservationId: res._id });
                        toast.success("Reservation cancelled.");
                      })
                    }
                  >
                    <X className="mr-1 h-3 w-3" /> Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Waiting For */}
      <WaitlistPreviewSection />

      {/* Books I've Shared */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
          <Share2 className="h-4.5 w-4.5 text-primary" />
          Books I&apos;ve Shared
        </h2>
        {sharedCopies === undefined ? (
          <div className="animate-shimmer h-4 w-40 rounded-md bg-muted" />
        ) : sharedCopies.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/60 p-5 text-center text-[0.8125rem] text-muted-foreground">
            You haven&apos;t shared any books yet.{" "}
            <Link href="/share" className="font-medium text-primary underline underline-offset-2">
              Share a book
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sharedCopies.map((copy) => (
              <div
                key={copy._id}
                className="book-spine flex items-center justify-between rounded-xl border border-border/40 bg-card/60 p-4 pl-5"
              >
                <div>
                  <Link
                    href={`/copy/${copy._id}`}
                    className="text-[0.875rem] font-medium hover:underline"
                  >
                    Copy #{copy._id.slice(-6)}
                  </Link>
                  <p className="text-[0.75rem] capitalize text-muted-foreground">
                    {copy.ownershipType}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      copy.status === "available" ? "default" : "secondary"
                    }
                    className="text-[0.6875rem]"
                  >
                    {COPY_STATUS_LABELS[copy.status as CopyStatus]}
                  </Badge>
                  {copy.ownershipType === "lent" &&
                    (copy.status === "available" ||
                      copy.status === "checked_out") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg text-[0.75rem]"
                        disabled={actionLoading === `recall-${copy._id}`}
                        onClick={() =>
                          handleAction(`recall-${copy._id}`, async () => {
                            await recallCopy({ copyId: copy._id });
                            toast.success("Copy recall initiated.");
                          })
                        }
                      >
                        <RotateCcw className="mr-1 h-3 w-3" /> Recall
                      </Button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Return Dialog */}
      <ReturnDialog copyId={returnCopyId} onClose={() => setReturnCopyId(null)} />
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
