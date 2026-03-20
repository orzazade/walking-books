"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { MapPin, BookOpen } from "lucide-react";
import Link from "next/link";

export function FavoriteLocationsSection() {
  const { isAuthenticated } = useConvexAuth();
  const favorites = useQuery(api.favoriteLocations.myFavorites, isAuthenticated ? {} : "skip");

  if (!favorites || favorites.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
        <MapPin className="h-4.5 w-4.5 text-primary" />
        My Locations
      </h2>
      <div className="space-y-2.5">
        {favorites.slice(0, 5).map((fav) => (
          <Link key={fav._id} href={`/locations/${fav.locationId}`}>
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:border-border">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.875rem] font-medium">
                  {fav.name}
                </p>
                <p className="mt-0.5 truncate text-[0.75rem] text-muted-foreground">
                  {fav.address}
                </p>
              </div>
              <Badge
                variant={fav.availableBooks > 0 ? "default" : "secondary"}
                className="ml-3 shrink-0 gap-1 rounded-md text-[0.6875rem]"
              >
                <BookOpen className="h-3 w-3" />
                {fav.availableBooks} available
              </Badge>
            </div>
          </Link>
        ))}
      </div>
      {favorites.length > 5 && (
        <Link
          href="/locations"
          className="mt-2 block text-center text-[0.75rem] text-primary hover:underline"
        >
          View all saved locations
        </Link>
      )}
    </section>
  );
}
