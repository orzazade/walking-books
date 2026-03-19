"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  MapPin,
  Users,
  Calendar,
  BookOpen,
  Clock,
  MessageSquare,
} from "lucide-react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function JourneyContent({ copyId }: { copyId: Id<"copies"> }) {
  const summary = useQuery(api.bookJourney.summary, { copyId });
  const stops = useQuery(api.bookJourney.forCopy, { copyId });

  // Loading
  if (summary === undefined || stops === undefined) {
    return (
      <div className="space-y-4">
        <div className="animate-shimmer h-6 w-48 rounded-md bg-muted" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/40 bg-card/60 p-4"
            >
              <div className="animate-shimmer h-3 w-16 rounded-md bg-muted" />
              <div className="animate-shimmer mt-2 h-6 w-10 rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Book info */}
      <div>
        <h1 className="font-serif text-[1.75rem] font-semibold tracking-[-0.01em]">
          {summary.bookTitle}
        </h1>
        <p className="mt-0.5 text-[0.875rem] text-muted-foreground">
          by {summary.bookAuthor}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[0.6875rem]">
            {summary.copyStatus}
          </Badge>
          <Badge variant="secondary" className="text-[0.6875rem]">
            {summary.copyCondition}
          </Badge>
          {summary.currentLocation && (
            <span className="flex items-center gap-1 text-[0.75rem] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {summary.currentLocation.name}
            </span>
          )}
          {summary.currentHolder && (
            <span className="flex items-center gap-1 text-[0.75rem] text-muted-foreground">
              <Users className="h-3 w-3" />
              Held by {summary.currentHolder.name}
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard
          label="Readers"
          value={summary.totalReaders}
          icon={Users}
        />
        <StatCard
          label="Locations"
          value={summary.uniqueLocations}
          icon={MapPin}
        />
        <StatCard
          label="Lendings"
          value={summary.completedLendings}
          icon={BookOpen}
        />
        <StatCard
          label="Avg days"
          value={summary.avgDaysPerLending ?? 0}
          icon={Clock}
          suffix={summary.avgDaysPerLending !== null ? "" : undefined}
          emptyText="N/A"
        />
      </div>

      {/* Timeline */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
          <Calendar className="h-4.5 w-4.5 text-primary" />
          Journey Timeline
        </h2>

        {stops.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-lg font-semibold">
              No journey yet
            </h3>
            <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
              This copy hasn&apos;t been picked up by anyone yet.
            </p>
          </div>
        ) : (
          <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-[17px] top-3 bottom-3 w-px bg-border/60" />

            {stops.map((stop, i) => (
              <div key={i} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Timeline dot */}
                <div
                  className={`relative z-10 mt-1.5 flex h-[9px] w-[9px] shrink-0 rounded-full ring-4 ring-background ${
                    !stop.returnedAt
                      ? "bg-primary"
                      : "bg-muted-foreground/40"
                  }`}
                  style={{ marginLeft: "13px" }}
                />

                {/* Content */}
                <div className="min-w-0 flex-1 rounded-xl border border-border/40 bg-card/60 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/profile/${stop.readerId}`}
                        className="text-[0.875rem] font-medium hover:underline"
                      >
                        {stop.readerName}
                      </Link>
                      <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                        {formatDate(stop.pickedUpAt)}
                        {stop.returnedAt
                          ? ` — ${formatDate(stop.returnedAt)}`
                          : " — currently reading"}
                      </p>
                    </div>
                    {stop.daysHeld !== null && (
                      <span className="shrink-0 text-[0.75rem] text-muted-foreground">
                        {stop.daysHeld} {stop.daysHeld === 1 ? "day" : "days"}
                      </span>
                    )}
                  </div>

                  {/* Locations */}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Picked up: {stop.pickupLocation.name}
                    </span>
                    {stop.returnLocation && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Returned: {stop.returnLocation.name}
                      </span>
                    )}
                  </div>

                  {/* Condition change */}
                  {stop.conditionAtReturn &&
                    stop.conditionAtReturn !== stop.conditionAtPickup && (
                      <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
                        Condition: {stop.conditionAtPickup} →{" "}
                        {stop.conditionAtReturn}
                      </p>
                    )}

                  {/* Reader note */}
                  {stop.readerNote && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-2">
                      <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <p className="text-[0.75rem] text-muted-foreground">
                        {stop.readerNote}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  suffix,
  emptyText,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  suffix?: string;
  emptyText?: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4">
      <div className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 font-serif text-[1.5rem] font-semibold leading-none">
        {value === 0 && emptyText ? emptyText : `${value}${suffix ?? ""}`}
      </div>
    </div>
  );
}

export default function BookJourneyPage() {
  const params = useParams();
  const copyId = params.id as Id<"copies">;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href={`/copy/${copyId}`}
        className="mb-6 inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to copy
      </Link>

      <div className="section-kicker mb-3">Book Journey</div>

      <JourneyContent copyId={copyId} />
    </main>
  );
}
