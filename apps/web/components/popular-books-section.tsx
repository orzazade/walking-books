"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, TrendingUp } from "lucide-react";
import Link from "next/link";

export function PopularBooksSection({
  locationId,
}: {
  locationId: Id<"partnerLocations">;
}) {
  const books = useQuery(api.partnerLocations.popularBooks, { locationId });

  if (books === undefined) {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold font-serif flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Popular Here
        </h2>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (books.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold font-serif flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" /> Popular Here
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {books.map((book) => (
          <Link
            key={book._id}
            href={`/book/${book._id}`}
            className="flex-shrink-0"
          >
            <Card className="w-[130px] cursor-pointer transition-colors hover:bg-muted/50">
              <CardContent className="p-3 space-y-2">
                {book.coverImage ? (
                  <img
                    src={book.coverImage}
                    alt={book.title}
                    className="h-[160px] w-full rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-[160px] w-full items-center justify-center rounded-md bg-muted">
                    <BookOpen className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <p className="text-sm font-medium truncate">{book.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {book.author}
                </p>
                <p className="text-xs text-primary font-medium">
                  {book.pickupCount} {book.pickupCount === 1 ? "pickup" : "pickups"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
