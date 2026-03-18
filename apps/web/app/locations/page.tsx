"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LocationMap } from "@/components/location-map";
import { Badge } from "@/components/ui/badge";
import { MapPin, BookOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function LocationsPage() {
  const locations = useQuery(api.partnerLocations.list);
  const [selectedId, setSelectedId] = useState<string>();

  if (locations === undefined) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8">
          <div className="section-kicker mb-3">Network</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Partner Locations
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Find a book drop-off or pickup point near you
          </p>
        </div>
        <div className="animate-shimmer h-80 rounded-2xl bg-muted" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Network</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Partner Locations
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Find a book drop-off or pickup point near you
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-[0.8125rem] text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>{locations.length} locations</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/40">
        <LocationMap
          locations={locations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((loc) => (
          <Link key={loc._id} href={`/locations/${loc._id}`}>
            <article
              className={`group rounded-2xl border bg-card/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md hover:shadow-primary/[0.04] ${
                selectedId === loc._id
                  ? "border-primary/40 bg-primary/[0.03]"
                  : "border-border/40"
              }`}
            >
              <h3 className="font-serif text-[0.9375rem] font-semibold">
                {loc.name}
              </h3>
              <div className="mt-2 flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{loc.address}</span>
              </div>
              <div className="mt-3">
                <Badge
                  variant="secondary"
                  className="gap-1 rounded-md text-[0.6875rem]"
                >
                  <BookOpen className="h-3 w-3" />
                  {loc.currentBookCount} books
                </Badge>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </main>
  );
}
