"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EventCard } from "@/components/location-events-section";
import { Calendar } from "lucide-react";

export default function EventsPage() {
  const events = useQuery(api.locationEvents.upcoming);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <p className="section-kicker">Community</p>
        <h1 className="text-3xl font-bold font-serif">Upcoming Events</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reading meetups, author visits, and book clubs at partner locations
        </p>
      </div>

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
    </main>
  );
}
