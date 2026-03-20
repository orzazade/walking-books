"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { LocationMap } from "@/components/location-map";
import { LocationReviewsSection } from "@/components/location-reviews-section";
import { PopularBooksSection } from "@/components/popular-books-section";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Clock, BookOpen, Phone, Mail } from "lucide-react";
import Link from "next/link";
import { CONDITION_LABELS, type Condition } from "@/convex/lib/validators";

export default function LocationDetailPage() {
  const params = useParams();
  const locationId = params.id as Id<"partnerLocations">;

  const location = useQuery(api.partnerLocations.byId, { locationId });
  const copies = useQuery(api.copies.byLocationWithBooks, { locationId });

  if (location === undefined) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (location === null) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-muted-foreground">Location not found.</p>
      </main>
    );
  }

  const hours =
    typeof location.operatingHours === "object" && location.operatingHours
      ? (location.operatingHours as Record<string, string>)
      : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">{location.name}</h1>

      <div className="mt-2 flex items-center gap-1 text-muted-foreground">
        <MapPin className="h-4 w-4" />
        <span>{location.address}</span>
      </div>

      <div className="mt-4">
        <LocationMap
          locations={[location]}
          center={[location.lat, location.lng]}
          zoom={15}
          className="h-[250px] w-full rounded-lg"
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" /> Operating Hours
            </h2>
            {hours ? (
              <div className="space-y-1 text-sm">
                {Object.entries(hours).map(([day, time]) => (
                  <div key={day} className="flex justify-between">
                    <span className="capitalize text-muted-foreground">
                      {day}
                    </span>
                    <span>{time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Hours not available
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold">Contact</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{location.contactPhone}</span>
              </div>
              {location.contactEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{location.contactEmail}</span>
                </div>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Shelf capacity</span>
              <span>{location.shelfCapacity} books</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Currently holding</span>
              <Badge variant="secondary" className="gap-1">
                <BookOpen className="h-3 w-3" />
                {location.currentBookCount}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {location.photos.length > 0 && (
        <>
          <Separator className="my-6" />
          <h2 className="mb-3 text-xl font-semibold">Photos</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {location.photos.map((photo, i) => (
              <div
                key={i}
                className="aspect-video overflow-hidden rounded-lg bg-muted"
              >
                <img
                  src={photo}
                  alt={`${location.name} photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </>
      )}

      <Separator className="my-6" />

      <PopularBooksSection locationId={locationId} />

      <Separator className="my-6" />

      <h2 className="mb-4 text-xl font-semibold">
        Available Books ({copies?.length ?? 0})
      </h2>
      {copies === undefined ? (
        <p className="text-muted-foreground">Loading books...</p>
      ) : copies.length === 0 ? (
        <p className="text-muted-foreground">
          No books available at this location right now.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {copies.map((copy) => (
            <Link key={copy._id} href={`/book/${copy.book._id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 p-4">
                  {copy.book.coverImage ? (
                    <img
                      src={copy.book.coverImage}
                      alt={copy.book.title}
                      className="h-16 w-11 flex-shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-11 flex-shrink-0 items-center justify-center rounded bg-muted">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{copy.book.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {copy.book.author}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {CONDITION_LABELS[copy.condition as Condition]} &middot;{" "}
                      {copy.ownershipType}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Separator className="my-6" />

      <LocationReviewsSection locationId={locationId} />
    </main>
  );
}
