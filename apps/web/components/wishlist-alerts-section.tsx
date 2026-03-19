"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Star, MapPin } from "lucide-react";
import Link from "next/link";

export function WishlistAlertsSection() {
  const { isAuthenticated } = useConvexAuth();
  const wishlistAvailable = useQuery(
    api.wishlist.availableNow,
    isAuthenticated ? {} : "skip",
  );

  if (!wishlistAvailable || wishlistAvailable.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
        <Heart className="h-4.5 w-4.5 text-primary" />
        Available on Your Wishlist
      </h2>
      <div className="space-y-2.5">
        {wishlistAvailable.map((item) => (
          <div
            key={item.bookId}
            className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              {item.coverImage && (
                <img
                  src={item.coverImage}
                  alt={item.title}
                  className="h-14 w-10 shrink-0 rounded object-cover"
                />
              )}
              <div>
                <Link
                  href={`/book/${item.bookId}`}
                  className="text-[0.875rem] font-medium hover:underline"
                >
                  {item.title}
                </Link>
                <p className="text-[0.75rem] text-muted-foreground">
                  {item.author}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {item.avgRating > 0 && (
                    <span className="flex items-center gap-0.5 text-[0.6875rem] text-muted-foreground">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {item.avgRating}
                    </span>
                  )}
                  <Badge variant="default" className="text-[0.6875rem]">
                    {item.availableCount} {item.availableCount === 1 ? "copy" : "copies"} available
                  </Badge>
                </div>
                {item.locations.length > 0 && (
                  <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {item.locations.map((l) => l.name).join(", ")}
                  </p>
                )}
              </div>
            </div>
            <Link
              href={`/book/${item.bookId}`}
              className="shrink-0"
            >
              <Button size="sm" className="h-7 rounded-lg text-[0.75rem]">
                View &amp; Reserve
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
