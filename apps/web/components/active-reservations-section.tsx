"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ReservationTimer } from "@/components/reservation-timer";
import { Clock, PackageCheck, X } from "lucide-react";
import { toast } from "sonner";

export function ActiveReservationsSection() {
  const activeReservations = useQuery(api.reservations.active, {});
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

  async function handlePickup(
    copyId: Id<"copies">,
    locationId: Id<"partnerLocations">,
    reservationId: Id<"reservations">,
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
  );
}
