"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/stat-card";
import {
  BookOpen,
  Clock,
  ScanLine,
  Package,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Calendar,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { CONDITION_LABELS, COPY_STATUS_LABELS, EVENT_TYPE_LABELS, type CopyStatus, type Condition, type EventType } from "@/convex/lib/validators";
import { CreateEventDialog } from "@/components/create-event-dialog";

function PartnerDashboardContent() {
  const location = useQuery(api.partnerLocations.myLocation);

  if (location === undefined) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (location === null) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">
            No partner location found for your account. Contact an admin to get
            set up.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <LocationDashboard locationId={location._id} locationName={location.name} shelfCapacity={location.shelfCapacity} />;
}

function LocationDashboard({
  locationId,
  locationName,
  shelfCapacity,
}: {
  locationId: Id<"partnerLocations">;
  locationName: string;
  shelfCapacity: number;
}) {
  const allCopies = useQuery(api.copies.allAtLocation, { locationId });
  const reservations = useQuery(api.reservations.byLocation, { locationId });
  const events = useQuery(api.locationEvents.byLocation, { locationId });

  if (allCopies === undefined || reservations === undefined) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const availableCopies = allCopies.filter((c) => c.status === "available");
  const reservedCopies = allCopies.filter((c) => c.status === "reserved");
  const checkedOutCopies = allCopies.filter((c) => c.status === "checked_out");
  const damagedCopies = allCopies.filter(
    (c) => c.status === "damaged" || c.status === "lost",
  );

  const activeReservations = reservations.filter(
    (r) => r.status === "active",
  );
  const shelfUtilization = shelfCapacity > 0
    ? Math.round((allCopies.length / shelfCapacity) * 100)
    : 0;

  return (
    <>
      {/* Location header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{locationName}</h1>
        <p className="mt-1 text-muted-foreground">Partner Dashboard</p>
      </div>

      {/* Quick actions */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/partner/scan">
          <Button className="gap-2">
            <ScanLine className="h-4 w-4" /> Scan QR Code
          </Button>
        </Link>
        <Link href="/partner/inventory">
          <Button variant="outline" className="gap-2">
            <Package className="h-4 w-4" /> View Inventory
          </Button>
        </Link>
        <CreateEventDialog locationId={locationId} />
      </div>

      {/* Today's overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={BookOpen} label="On Shelf" value={availableCopies.length} />
        <StatCard icon={Clock} label="Reserved" value={reservedCopies.length} iconClassName="text-amber-500" />
        <StatCard icon={CheckCircle} label="Checked Out" value={checkedOutCopies.length} iconClassName="text-green-500" />
        <StatCard icon={Package} label="Capacity" value={`${shelfUtilization}%`} iconClassName="text-muted-foreground" />
      </div>

      <Separator className="my-6" />

      {/* Pending pickups (expiring reservations) */}
      <section>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Pending Pickups
        </h2>
        {activeReservations.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              No active reservations right now.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeReservations.map((res) => {
              const minutesLeft = Math.max(
                0,
                Math.round((res.expiresAt - Date.now()) / 60000),
              );
              const isUrgent = minutesLeft < 15;
              return (
                <Card key={res._id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">
                        Copy #{res.copyId.slice(-6)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Reserved{" "}
                        {new Date(res.reservedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isUrgent ? "destructive" : "secondary"}
                      >
                        {minutesLeft}m left
                      </Badge>
                      <Link href="/partner/scan">
                        <Button variant="outline" size="sm" className="gap-1">
                          <ScanLine className="h-3 w-3" /> Scan
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* Shelf inventory quick view */}
      <section>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Shelf Inventory
        </h2>
        {availableCopies.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              No books currently on the shelf.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {availableCopies.slice(0, 5).map((copy) => (
              <Card key={copy._id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">
                      Copy #{copy._id.slice(-6)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Condition: {CONDITION_LABELS[copy.condition as Condition]}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {COPY_STATUS_LABELS[copy.status as CopyStatus]}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {availableCopies.length > 5 && (
              <Link
                href="/partner/inventory"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View all {availableCopies.length} books{" "}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Upcoming events */}
      <Separator className="my-6" />
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Upcoming Events
          </h2>
          <CreateEventDialog locationId={locationId} />
        </div>
        {events === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-shimmer h-16 rounded-lg bg-muted" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              No upcoming events. Create one to attract readers!
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 5).map((event) => {
              const isFull =
                event.capacity !== undefined && event.rsvpCount >= event.capacity;
              return (
                <Card key={event._id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{event.title}</p>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {EVENT_TYPE_LABELS[event.eventType as EventType]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {new Date(event.startsAt).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span>
                          {new Date(event.startsAt).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          {" – "}
                          {new Date(event.endsAt).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {event.rsvpCount}
                          {event.capacity !== undefined && ` / ${event.capacity}`}
                          {isFull && (
                            <Badge
                              variant="secondary"
                              className="ml-1 text-xs bg-amber-100 text-amber-600 border-amber-200"
                            >
                              Full
                            </Badge>
                          )}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {events.length > 5 && (
              <Link
                href="/events"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View all {events.length} events{" "}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Flagged items */}
      {damagedCopies.length > 0 && (
        <>
          <Separator className="my-6" />
          <section>
            <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Flagged
              Items
            </h2>
            <div className="space-y-3">
              {damagedCopies.map((copy) => (
                <Card key={copy._id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <p className="font-medium">
                      Copy #{copy._id.slice(-6)}
                    </p>
                    <Badge variant="destructive">
                      {COPY_STATUS_LABELS[copy.status as CopyStatus]}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

export default function PartnerDashboardPage() {
  return <PartnerDashboardContent />;
}
