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
  MapPin,
  Heart,
  Star,
  BarChart3,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";


function DashboardContent() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser, isAuthenticated ? {} : "skip");
  const readingStats = useQuery(api.readingStats.getStats, isAuthenticated ? {} : "skip");
  const myWaitlist = useQuery(api.waitlist.myWaitlist, isAuthenticated ? {} : "skip");
  const wishlistAvailable = useQuery(api.wishlist.availableNow, isAuthenticated ? {} : "skip");
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
      {readingStats && readingStats.totalBooksRead > 0 && (
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
                  {readingStats.avgDaysPerBook ?? "—"}{" "}
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
                  {readingStats.uniqueLocationsVisited}
                </p>
              </div>
              <div>
                <span className="text-[0.75rem] text-muted-foreground">
                  Currently reading
                </span>
                <p className="mt-0.5 font-serif text-lg font-semibold">
                  {readingStats.currentlyReading}
                </p>
              </div>
            </div>

            {readingStats.topGenres.length > 0 && (
              <div className="mt-4 border-t border-border/40 pt-4">
                <span className="text-[0.75rem] text-muted-foreground">
                  Top genres
                </span>
                <div className="mt-2 space-y-1.5">
                  {readingStats.topGenres.map((g) => {
                    const maxCount = readingStats.topGenres[0].count;
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

            {readingStats.monthlyActivity.some((m) => m.count > 0) && (
              <div className="mt-4 border-t border-border/40 pt-4">
                <span className="text-[0.75rem] text-muted-foreground">
                  Monthly activity (last 12 months)
                </span>
                <div className="mt-2 flex items-end gap-1">
                  {readingStats.monthlyActivity.map((m) => {
                    const maxCount = Math.max(
                      ...readingStats.monthlyActivity.map((x) => x.count),
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
      )}

      {/* Wishlist Alerts */}
      {wishlistAvailable && wishlistAvailable.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
            <Heart className="h-4.5 w-4.5 text-primary" />
            Available on Your Wishlist
          </h2>
          <div className="space-y-2.5">
            {wishlistAvailable.map((item) => (
              <div
                key={item.bookId}
                className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  {item.coverImage && (
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="h-14 w-10 shrink-0 rounded object-cover"
                    />
                  )}
                  <div>
                    <Link
                      href={`/book/${item.bookId}`}
                      className="text-[0.875rem] font-medium hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="text-[0.75rem] text-muted-foreground">
                      {item.author}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {item.avgRating > 0 && (
                        <span className="flex items-center gap-0.5 text-[0.6875rem] text-muted-foreground">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {item.avgRating}
                        </span>
                      )}
                      <Badge variant="default" className="text-[0.6875rem]">
                        {item.availableCount} {item.availableCount === 1 ? "copy" : "copies"} available
                      </Badge>
                    </div>
                    {item.locations.length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {item.locations.map((l) => l.name).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  href={`/book/${item.bookId}`}
                  className="shrink-0"
                >
                  <Button size="sm" className="h-7 rounded-lg text-[0.75rem]">
                    View &amp; Reserve
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

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
      {myWaitlist && myWaitlist.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
            <Bell className="h-4.5 w-4.5 text-primary" />
            Waiting For
          </h2>
          <div className="space-y-2.5">
            {myWaitlist.map((entry) => (
              <div
                key={entry._id}
                className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                  entry.status === "notified"
                    ? "border-primary/20 bg-primary/5"
                    : "border-border/40 bg-card/60"
                }`}
              >
                <div className="flex items-start gap-3">
                  {entry.coverImage && (
                    <img
                      src={entry.coverImage}
                      alt={entry.title}
                      className="h-14 w-10 shrink-0 rounded object-cover"
                    />
                  )}
                  <div>
                    <Link
                      href={`/book/${entry.bookId}`}
                      className="text-[0.875rem] font-medium hover:underline"
                    >
                      {entry.title}
                    </Link>
                    <p className="text-[0.75rem] text-muted-foreground">
                      {entry.author}
                    </p>
                    <Badge
                      variant={entry.status === "notified" ? "default" : "secondary"}
                      className="mt-1 text-[0.6875rem]"
                    >
                      {entry.status === "notified"
                        ? "Copy available!"
                        : `#${entry.position} in queue`}
                    </Badge>
                  </div>
                </div>
                <Link href={`/book/${entry.bookId}`} className="shrink-0">
                  <Button
                    size="sm"
                    variant={entry.status === "notified" ? "default" : "outline"}
                    className="h-7 rounded-lg text-[0.75rem]"
                  >
                    {entry.status === "notified" ? "View & Reserve" : "View Book"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          {myWaitlist.length > 3 && (
            <Link
              href="/waitlist"
              className="mt-2 block text-center text-[0.75rem] text-primary hover:underline"
            >
              View all waitlisted books
            </Link>
          )}
        </section>
      )}

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
