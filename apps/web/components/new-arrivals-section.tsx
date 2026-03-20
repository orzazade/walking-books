"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MapPin } from "lucide-react";
import Link from "next/link";

export function NewArrivalsSection() {
  const { isAuthenticated } = useConvexAuth();
  const arrivals = useQuery(
    api.favoriteLocations.newArrivals,
    isAuthenticated ? {} : "skip",
  );

  if (!arrivals || arrivals.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
        <Sparkles className="h-4.5 w-4.5 text-primary" />
        New at Your Locations
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {arrivals.map((item) => (
          <Link
            key={item.copyId}
            href={`/book/${item.bookId}`}
            className="group shrink-0"
          >
            <div className="w-[130px] overflow-hidden rounded-xl border border-border/40 bg-card/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-border">
              {/* Cover */}
              <div className="aspect-[2/3] overflow-hidden bg-muted">
                {item.coverImage ? (
                  <img
                    src={item.coverImage}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[0.5rem] text-muted-foreground">
                    No cover
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-2.5">
                <p className="truncate text-[0.75rem] font-medium">
                  {item.title}
                </p>
                <p className="truncate text-[0.6875rem] text-muted-foreground">
                  {item.author}
                </p>
                <div className="mt-1.5 flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="truncate text-[0.625rem] text-muted-foreground">
                    {item.locationName}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="mt-1.5 gap-0.5 rounded-md px-1.5 py-0 text-[0.5625rem] text-green-600 dark:text-emerald-400"
                >
                  New
                </Badge>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
