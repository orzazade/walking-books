"use client";

import { useQuery, useConvexAuth, Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EventCard, RsvpEventCard } from "@/components/location-events-section";
import { Calendar, Ticket } from "lucide-react";

export default function EventsPage() {
  const { isAuthenticated } = useConvexAuth();
  const events = useQuery(api.locationEvents.upcoming);
  const myRsvps = useQuery(
    api.locationEvents.myRsvps,
    isAuthenticated ? {} : "skip",
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <p className="section-kicker">Community</p>
        <h1 className="text-3xl font-bold font-serif">Upcoming Events</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reading meetups, author visits, and book clubs at partner locations
        </p>
      </div>

      <Authenticated>
        <MyRsvpsSection rsvps={myRsvps} />
      </Authenticated>

      <div>
        <h2 className="mb-3 text-xl font-semibold font-serif">All Events</h2>
        {events === undefined ? (
          <p className="text-sm text-muted-foreground">Loading events...</p>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No upcoming events</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check back soon — partner locations post events regularly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function MyRsvpsSection({
  rsvps,
}: {
  rsvps:
    | Array<{
        _id: string;
        _creationTime: number;
        title: string;
        description: string;
        eventType: string;
        startsAt: number;
        endsAt: number;
        capacity?: number;
        rsvpCount: number;
        rsvpId: string;
        locationName: string;
        locationAddress: string;
        locationId: string;
        createdByUserId: string;
      }>
    | undefined;
}) {
  if (rsvps === undefined) {
    return (
      <div className="mb-8">
        <h2 className="mb-3 text-xl font-semibold font-serif">My RSVPs</h2>
        <p className="text-sm text-muted-foreground">Loading your events...</p>
      </div>
    );
  }

  if (rsvps.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="mb-3 text-xl font-semibold font-serif">My RSVPs</h2>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            You haven&apos;t RSVPed to any upcoming events yet. Browse below to
            find one!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-xl font-semibold font-serif">My RSVPs</h2>
      <div className="space-y-3">
        {rsvps.map((event) => (
          <RsvpEventCard key={event._id} event={event} />
        ))}
      </div>
    </div>
  );
}
