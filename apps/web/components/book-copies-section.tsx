"use client";

import { useState } from "react";
import { useQuery, useMutation, Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CONDITION_LABELS, COPY_STATUS_LABELS, type Condition, type CopyStatus } from "@/convex/lib/validators";
import { getErrorMessage } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReservationTimer } from "@/components/reservation-timer";
import { CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

const COPY_STATUS_COLOR: Record<string, string> = {
  available: "bg-primary/10 text-primary border-primary/20",
  reserved: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
};

export function BookCopiesSection({ bookId }: { bookId: Id<"books"> }) {
  const copies = useQuery(api.copies.byBook, { bookId });
  const activeReservations = useQuery(api.reservations.active);
  const createReservation = useMutation(api.reservations.create);

  const [reservingCopyId, setReservingCopyId] = useState<string | null>(null);
  const [justReserved, setJustReserved] = useState<{
    copyId: string;
    expiresAt: number;
  } | null>(null);

  const availableCopies =
    copies?.filter((c) => c.status === "available") ?? [];

  const userHasReservationForBook = activeReservations?.some((r) =>
    copies?.some((c) => c._id === r.copyId),
  );

  async function handleReserve(
    copyId: Id<"copies">,
    locationId: Id<"partnerLocations">,
  ) {
    setReservingCopyId(copyId);
    try {
      const result = await createReservation({ copyId, locationId });
      setJustReserved({ copyId, expiresAt: result.expiresAt });
      toast.success("Book reserved! Head to the location to pick it up.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to reserve"));
    } finally {
      setReservingCopyId(null);
    }
  }

  return (
    <section>
      <div className="mb-4">
        <div className="section-kicker mb-2">Availability</div>
        <h2 className="font-serif text-[1.25rem] font-semibold">
          Available Copies ({availableCopies.length})
        </h2>
      </div>
      {copies === undefined ? (
        <div className="animate-shimmer h-16 rounded-xl bg-muted" />
      ) : copies.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-10 text-center text-[0.8125rem] text-muted-foreground">
          No copies registered yet. Be the first to share this book.
        </div>
      ) : (
        <div className="space-y-2.5">
          {copies.map((copy) => {
            const isJustReserved = justReserved?.copyId === copy._id;
            const isReserving = reservingCopyId === copy._id;

            return (
              <div
                key={copy._id}
                className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:border-border"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <Badge
                        className={`rounded-md border text-[0.6875rem] ${COPY_STATUS_COLOR[copy.status] ?? "bg-secondary text-secondary-foreground border-border/40"}`}
                      >
                        {COPY_STATUS_LABELS[copy.status as CopyStatus]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="rounded-md text-[0.6875rem]"
                      >
                        {CONDITION_LABELS[copy.condition as Condition]}
                      </Badge>
                    </div>
                    <p className="text-[0.75rem] text-muted-foreground">
                      {copy.currentLocationId
                        ? "At partner location"
                        : "In transit"}
                    </p>
                  </div>

                  <Authenticated>
                    <div className="flex items-center gap-2">
                      {isJustReserved ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          <div className="text-right">
                            <p className="text-[0.75rem] font-medium text-primary">
                              Reserved!
                            </p>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <ReservationTimer
                                expiresAt={justReserved.expiresAt}
                              />
                            </div>
                          </div>
                        </div>
                      ) : copy.status === "available" &&
                        copy.currentLocationId ? (
                        userHasReservationForBook ? (
                          <span className="text-[0.75rem] text-amber-600 dark:text-amber-400">
                            You already have a reservation
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            className="h-8 rounded-lg text-[0.75rem]"
                            disabled={isReserving}
                            onClick={() =>
                              handleReserve(
                                copy._id,
                                copy.currentLocationId as Id<"partnerLocations">,
                              )
                            }
                          >
                            {isReserving ? "Reserving..." : "Reserve"}
                          </Button>
                        )
                      ) : copy.status === "available" ? (
                        <span className="text-[0.75rem] text-primary">
                          Available for pickup
                        </span>
                      ) : null}
                    </div>
                  </Authenticated>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export { COPY_STATUS_COLOR };
