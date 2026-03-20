"use client";

import { useQuery, useMutation } from "convex/react";
import { Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { EVENT_TYPE_LABELS, type EventType } from "@/convex/lib/validators";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, MapPin } from "lucide-react";
import { toast } from "sonner";

function formatEventDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatEventTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function RsvpButton({ eventId }: { eventId: Id<"locationEvents"> }) {
  const myRsvp = useQuery(api.locationEvents.myRsvp, { eventId });
  const rsvpMutation = useMutation(api.locationEvents.rsvp);
  const cancelMutation = useMutation(api.locationEvents.cancelRsvp);

  if (myRsvp === undefined) return null;

  if (myRsvp) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={async (e) => {
          e.preventDefault();
          try {
            await cancelMutation({ eventId });
            toast.success("RSVP cancelled");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to cancel RSVP");
          }
        }}
      >
        Cancel RSVP
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={async (e) => {
        e.preventDefault();
        try {
          await rsvpMutation({ eventId });
          toast.success("RSVPed successfully!");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to RSVP");
        }
      }}
    >
      RSVP
    </Button>
  );
}

export function LocationEventsSection({
  locationId,
}: {
  locationId: Id<"partnerLocations">;
}) {
  const events = useQuery(api.locationEvents.byLocation, { locationId });

  if (events === undefined) {
    return <p className="text-sm text-muted-foreground">Loading events...</p>;
  }

  if (events.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-xl font-semibold font-serif">Upcoming Events</h2>
        <p className="text-sm text-muted-foreground">
          No upcoming events at this location.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold font-serif">Upcoming Events</h2>
      <div className="space-y-3">
        {events.map((event) => {
          const isFull =
            event.capacity !== undefined && event.rsvpCount >= event.capacity;

          return (
            <Card key={event._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{event.title}</h3>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {EVENT_TYPE_LABELS[event.eventType as EventType]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {event.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatEventDate(event.startsAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatEventTime(event.startsAt)} –{" "}
                        {formatEventTime(event.endsAt)}
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
                  <Authenticated>
                    <RsvpButton eventId={event._id} />
                  </Authenticated>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function EventCard({
  event,
}: {
  event: {
    _id: Id<"locationEvents">;
    title: string;
    description: string;
    eventType: string;
    startsAt: number;
    endsAt: number;
    capacity?: number;
    rsvpCount: number;
    locationName: string;
    locationAddress: string;
  };
}) {
  const isFull =
    event.capacity !== undefined && event.rsvpCount >= event.capacity;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{event.title}</h3>
              <Badge variant="outline" className="shrink-0 text-xs">
                {EVENT_TYPE_LABELS[event.eventType as EventType]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {event.description}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.locationName}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatEventDate(event.startsAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatEventTime(event.startsAt)} –{" "}
                {formatEventTime(event.endsAt)}
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
          <Authenticated>
            <RsvpButton eventId={event._id} />
          </Authenticated>
        </div>
      </CardContent>
    </Card>
  );
}
