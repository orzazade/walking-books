"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LocationMap } from "@/components/location-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, BookOpen, Navigation, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "active"; lat: number; lng: number }
  | { status: "error"; message: string };

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function LocationCard({
  loc,
  selected,
  badges,
}: {
  loc: { _id: string; name: string; address: string };
  selected: boolean;
  badges: React.ReactNode;
}) {
  return (
    <Link href={`/locations/${loc._id}`}>
      <article
        className={`group rounded-2xl border bg-card/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md hover:shadow-primary/[0.04] ${
          selected
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
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {badges}
        </div>
      </article>
    </Link>
  );
}

export default function LocationsPage() {
  const [selectedId, setSelectedId] = useState<string>();
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });

  const nearbyActive = geo.status === "active";

  const plainLocations = useQuery(
    api.partnerLocations.list,
    nearbyActive ? "skip" : {},
  );
  const nearbyLocations = useQuery(
    api.partnerLocations.nearby,
    nearbyActive ? { lat: geo.lat, lng: geo.lng } : "skip",
  );

  // For the map and count, use whichever is loaded
  const mapLocations = nearbyActive ? nearbyLocations : plainLocations;
  const isLoading = mapLocations === undefined;

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeo({ status: "error", message: "Geolocation not supported" });
      toast.error("Your browser doesn't support geolocation");
      return;
    }
    setGeo({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          status: "active",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied"
            : "Could not determine location";
        setGeo({ status: "error", message });
        toast.error(message);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, []);

  const clearNearby = useCallback(() => {
    setGeo({ status: "idle" });
  }, []);

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
        <div className="flex flex-wrap items-center gap-2.5">
          {mapLocations && (
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-[0.8125rem] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{mapLocations.length} locations</span>
            </div>
          )}
          {nearbyActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={clearNearby}
              className="gap-1.5 rounded-lg text-[0.8125rem]"
            >
              <Navigation className="h-3.5 w-3.5 text-primary" />
              Near me
              <span className="text-muted-foreground">&times;</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={requestLocation}
              disabled={geo.status === "loading"}
              className="gap-1.5 rounded-lg text-[0.8125rem]"
            >
              {geo.status === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Navigation className="h-3.5 w-3.5" />
              )}
              {geo.status === "loading" ? "Locating..." : "Near me"}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="animate-shimmer h-80 rounded-2xl bg-muted" />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border/40">
            <LocationMap
              locations={mapLocations}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearbyActive && nearbyLocations
              ? nearbyLocations.map((loc) => (
                  <LocationCard
                    key={loc._id}
                    loc={loc}
                    selected={selectedId === loc._id}
                    badges={
                      <>
                        <Badge
                          variant={loc.availableBooks > 0 ? "default" : "secondary"}
                          className="gap-1 rounded-md text-[0.6875rem]"
                        >
                          <BookOpen className="h-3 w-3" />
                          {loc.availableBooks} available
                        </Badge>
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-md text-[0.6875rem]"
                        >
                          <Navigation className="h-3 w-3" />
                          {formatDistance(loc.distanceKm)}
                        </Badge>
                      </>
                    }
                  />
                ))
              : plainLocations?.map((loc) => (
                  <LocationCard
                    key={loc._id}
                    loc={loc}
                    selected={selectedId === loc._id}
                    badges={
                      <Badge
                        variant="secondary"
                        className="gap-1 rounded-md text-[0.6875rem]"
                      >
                        <BookOpen className="h-3 w-3" />
                        {loc.currentBookCount} books
                      </Badge>
                    }
                  />
                ))}
          </div>
        </>
      )}
    </main>
  );
}
