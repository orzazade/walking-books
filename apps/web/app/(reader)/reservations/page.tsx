"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import { ReservationTimer } from "@/components/reservation-timer";
import { LocationHoursBadge } from "@/components/location-hours-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage, formatDate } from "@/lib/utils";
import {
  BookOpen,
  Calendar,
  Clock,
  MapPin,
  PackageCheck,
  X,
  CheckCircle2,
  XCircle,
  TimerOff,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG = {
  fulfilled: {
    label: "Picked Up",
    icon: CheckCircle2,
    className: "border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
  },
  expired: {
    label: "Expired",
    icon: TimerOff,
    className: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
  },
} as const;

function ActiveSection() {
  const activeReservations = useQuery(api.reservations.myActive, {});
  const cancelReservation = useMutation(api.reservations.cancel);
  const pickupCopy = useMutation(api.copies.pickup);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  if (activeReservations === undefined) {
    return (
      <div className="space-y-2.5">
        {[1, 2].map((i) => (
          <div key={i} className="animate-shimmer h-24 rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (activeReservations.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/60 p-5 text-center text-[0.8125rem] text-muted-foreground">
        No active reservations. <Link href="/browse" className="text-primary hover:underline">Browse books</Link> to reserve one.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {activeReservations.map((res) => (
        <div
          key={res._id}
          className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
        >
          <div className="flex gap-3">
            <Link
              href={res.bookId ? `/book/${res.bookId}` : `/copy/${res.copyId}`}
              className="shrink-0"
            >
              {res.coverImage ? (
                <img
                  src={res.coverImage}
                  alt={res.bookTitle}
                  className="h-16 w-11 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-16 w-11 items-center justify-center rounded-md bg-muted">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link
                    href={res.bookId ? `/book/${res.bookId}` : `/copy/${res.copyId}`}
                    className="text-sm font-medium leading-tight hover:underline"
                  >
                    {res.bookTitle}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {res.bookAuthor}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{res.locationName}</span>
                  </div>
                  {res.operatingHours && (
                    <div className="mt-0.5 pl-[1.125rem]">
                      <LocationHoursBadge operatingHours={res.operatingHours as Record<string, string>} />
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Expires in:</span>
                    <ReservationTimer expiresAt={res.expiresAt} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="h-7 rounded-lg text-xs"
                    disabled={actionLoading === `pickup-${res.copyId}`}
                    onClick={() =>
                      handleAction(`pickup-${res.copyId}`, async () => {
                        await pickupCopy({
                          copyId: res.copyId,
                          locationId: res.locationId,
                          reservationId: res._id,
                          conditionAtPickup: "good",
                          photos: [],
                        });
                        toast.success("Book picked up!");
                      })
                    }
                  >
                    <PackageCheck className="mr-1 h-3 w-3" /> Pick Up
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg text-xs"
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
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistorySection() {
  const { isAuthenticated } = useConvexAuth();
  const history = useQuery(api.reservations.myHistory, isAuthenticated ? {} : "skip");

  if (history === undefined) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-shimmer h-20 rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/60 p-5 text-center text-[0.8125rem] text-muted-foreground">
        No past reservations yet.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {history.map((res) => {
        const config = STATUS_CONFIG[res.status as keyof typeof STATUS_CONFIG];
        const StatusIcon = config?.icon ?? Clock;

        return (
          <div
            key={res._id}
            className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
          >
            <div className="flex gap-3">
              <Link
                href={res.bookId ? `/book/${res.bookId}` : "#"}
                className="shrink-0"
              >
                {res.coverImage ? (
                  <img
                    src={res.coverImage}
                    alt={res.bookTitle}
                    className="h-16 w-11 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-11 items-center justify-center rounded-md bg-muted">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={res.bookId ? `/book/${res.bookId}` : "#"}
                      className="text-sm font-medium leading-tight hover:underline"
                    >
                      {res.bookTitle}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {res.bookAuthor}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{res.locationName}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>Reserved {formatDate(res.reservedAt)}</span>
                    </div>
                  </div>

                  {config && (
                    <Badge
                      variant="outline"
                      className={`shrink-0 gap-1 ${config.className}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReservationsContent() {
  const { isAuthenticated } = useConvexAuth();
  const activeReservations = useQuery(api.reservations.myActive, isAuthenticated ? {} : "skip");
  const history = useQuery(api.reservations.myHistory, isAuthenticated ? {} : "skip");

  const activeCount = activeReservations?.length ?? 0;
  const totalPast = history?.length ?? 0;
  const fulfilledCount = history?.filter((r) => r.status === "fulfilled").length ?? 0;

  return (
    <div className="space-y-8">
      {/* Summary stats */}
      {(activeReservations !== undefined && history !== undefined) && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
            <p className="text-2xl font-semibold font-serif">{activeCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Active</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
            <p className="text-2xl font-semibold font-serif">{fulfilledCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Picked Up</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
            <p className="text-2xl font-semibold font-serif">{totalPast}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">All Time</p>
          </div>
        </div>
      )}

      {/* Active reservations */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-semibold">
          <Clock className="h-4.5 w-4.5 text-primary" />
          Active Reservations
        </h2>
        <ActiveSection />
      </section>

      {/* Past reservations */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-semibold">
          <Calendar className="h-4.5 w-4.5 text-muted-foreground" />
          Past Reservations
        </h2>
        <HistorySection />
      </section>
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-8">
        <div className="section-kicker mb-3">Your Library</div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Reservations
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Track your active and past book reservations
        </p>
      </div>

      <Authenticated>
        <ReservationsContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see your reservations." />
      </Unauthenticated>
    </main>
  );
}
