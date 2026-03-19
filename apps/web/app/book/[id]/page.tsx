"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/star-rating";
import { getErrorMessage } from "@/lib/utils";
import { ReservationTimer } from "@/components/reservation-timer";
import { AddToCollectionDialog } from "@/components/add-to-collection-dialog";
import { BookReviewsSection } from "@/components/book-reviews-section";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { SimilarBooksSection } from "@/components/similar-books-section";
import { WaitlistSection } from "@/components/waitlist-section";
import { CheckCircle, Clock, BookOpen, Heart } from "lucide-react";
import Link from "next/link";
import { CONDITION_LABELS, COPY_STATUS_LABELS, type Condition, type CopyStatus } from "@/convex/lib/validators";

const COPY_STATUS_COLOR: Record<string, string> = {
  available: "bg-primary/10 text-primary border-primary/20",
  reserved: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
};

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as Id<"books">;

  const book = useQuery(api.books.byId, { bookId });
  const copies = useQuery(api.copies.byBook, { bookId });
  const activeReservations = useQuery(api.reservations.active);
  const isWishlisted = useQuery(api.wishlist.isWishlisted, { bookId });
  const toggleWishlist = useMutation(api.wishlist.toggle);
  const createReservation = useMutation(api.reservations.create);

  const [togglingWishlist, setTogglingWishlist] = useState(false);
  const [reservingCopyId, setReservingCopyId] = useState<string | null>(null);
  const [justReserved, setJustReserved] = useState<{
    copyId: string;
    expiresAt: number;
  } | null>(null);

  if (book === undefined) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="animate-shimmer h-80 w-full shrink-0 rounded-2xl bg-muted md:w-64" />
          <div className="flex-1 space-y-4">
            <div className="animate-shimmer h-8 w-3/4 rounded-lg bg-muted" />
            <div className="animate-shimmer h-5 w-1/3 rounded-lg bg-muted" />
            <div className="animate-shimmer h-4 w-1/4 rounded-lg bg-muted" />
          </div>
        </div>
      </main>
    );
  }

  if (book === null) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <EmptyState
          icon={BookOpen}
          title="Book not found"
          message="This book may have been removed from the network."
        />
      </main>
    );
  }

  const availableCopies =
    copies?.filter((c) => c.status === "available") ?? [];

  const userHasReservationForBook = activeReservations?.some((r) =>
    copies?.some((c) => c._id === r.copyId),
  );

  async function handleReserve(
    copyId: Id<"copies">,
    locationId: Id<"partnerLocations">,
  ) {
    setReservingCopyId(copyId);
    try {
      const result = await createReservation({ copyId, locationId });
      setJustReserved({ copyId, expiresAt: result.expiresAt });
      toast.success("Book reserved! Head to the location to pick it up.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to reserve"));
    } finally {
      setReservingCopyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      {/* Book metadata */}
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="w-full shrink-0 md:w-64">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-border/40 bg-muted">
            {book.coverImage ? (
              <img
                src={book.coverImage}
                alt={book.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-secondary">
                <div className="font-serif text-4xl text-muted-foreground/40">
                  W
                </div>
                <div className="max-w-[70%] text-center text-xs text-muted-foreground/50">
                  {book.title}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <h1 className="font-serif text-[1.75rem] font-semibold leading-tight tracking-[-0.01em]">
            {book.title}
          </h1>
          <p className="text-[0.9375rem] text-muted-foreground">
            by {book.author}
          </p>

          <div className="flex items-center gap-3">
            <StarRating rating={book.avgRating} />
            <span className="text-[0.8125rem] text-muted-foreground">
              {book.avgRating > 0
                ? `${book.avgRating} (${book.reviewCount} reviews)`
                : "No ratings yet"}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {book.categories.map((cat) => (
              <Badge
                key={cat}
                variant="secondary"
                className="rounded-md text-[0.6875rem]"
              >
                {cat}
              </Badge>
            ))}
          </div>

          {book.description && (
            <p className="text-[0.8125rem] leading-relaxed text-foreground/80">
              {book.description}
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-[0.8125rem] text-muted-foreground">
            {book.pageCount > 0 && <span>{book.pageCount} pages</span>}
            {book.language && <span>{book.language}</span>}
            {book.publisher && <span>{book.publisher}</span>}
          </div>

          <Authenticated>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={isWishlisted ? "default" : "outline"}
                size="sm"
                className="h-8 rounded-lg text-[0.75rem]"
                disabled={togglingWishlist}
                onClick={async () => {
                  setTogglingWishlist(true);
                  try {
                    const result = await toggleWishlist({ bookId });
                    toast.success(
                      result.wishlisted
                        ? "Added to your wishlist"
                        : "Removed from your wishlist",
                    );
                  } catch (err: unknown) {
                    toast.error(getErrorMessage(err, "Failed to update wishlist"));
                  } finally {
                    setTogglingWishlist(false);
                  }
                }}
              >
                <Heart
                  className={`mr-1.5 h-3.5 w-3.5 ${isWishlisted ? "fill-current" : ""}`}
                />
                {isWishlisted ? "On Wishlist" : "Add to Wishlist"}
              </Button>

              <AddToCollectionDialog bookId={bookId} />
            </div>
          </Authenticated>
        </div>
      </div>

      {/* Divider */}
      <div className="editorial-divider my-10">
        <div className="botanical-ornament" />
      </div>

      {/* Copies */}
      <section>
        <div className="mb-4">
          <div className="section-kicker mb-2">Availability</div>
          <h2 className="font-serif text-[1.25rem] font-semibold">
            Available Copies ({availableCopies.length})
          </h2>
        </div>
        {copies === undefined ? (
          <div className="animate-shimmer h-16 rounded-xl bg-muted" />
        ) : copies.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-10 text-center text-[0.8125rem] text-muted-foreground">
            No copies registered yet. Be the first to share this book.
          </div>
        ) : (
          <div className="space-y-2.5">
            {copies.map((copy) => {
              const isJustReserved = justReserved?.copyId === copy._id;
              const isReserving = reservingCopyId === copy._id;

              return (
                <div
                  key={copy._id}
                  className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <Badge
                          className={`rounded-md border text-[0.6875rem] ${COPY_STATUS_COLOR[copy.status] ?? "bg-secondary text-secondary-foreground border-border/40"}`}
                        >
                          {COPY_STATUS_LABELS[copy.status as CopyStatus]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-md text-[0.6875rem]"
                        >
                          {CONDITION_LABELS[copy.condition as Condition]}
                        </Badge>
                      </div>
                      <p className="text-[0.75rem] text-muted-foreground">
                        {copy.currentLocationId
                          ? "At partner location"
                          : "In transit"}
                      </p>
                    </div>

                    <Authenticated>
                      <div className="flex items-center gap-2">
                        {isJustReserved ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-primary" />
                            <div className="text-right">
                              <p className="text-[0.75rem] font-medium text-primary">
                                Reserved!
                              </p>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <ReservationTimer
                                  expiresAt={justReserved.expiresAt}
                                />
                              </div>
                            </div>
                          </div>
                        ) : copy.status === "available" &&
                          copy.currentLocationId ? (
                          userHasReservationForBook ? (
                            <span className="text-[0.75rem] text-amber-600 dark:text-amber-400">
                              You already have a reservation
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              className="h-8 rounded-lg text-[0.75rem]"
                              disabled={isReserving}
                              onClick={() =>
                                handleReserve(
                                  copy._id,
                                  copy.currentLocationId as Id<"partnerLocations">,
                                )
                              }
                            >
                              {isReserving ? "Reserving..." : "Reserve"}
                            </Button>
                          )
                        ) : copy.status === "available" ? (
                          <span className="text-[0.75rem] text-primary">
                            Available for pickup
                          </span>
                        ) : null}
                      </div>
                    </Authenticated>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Waitlist */}
      <Authenticated>
        {copies && copies.length > 0 && availableCopies.length === 0 && (
          <WaitlistSection bookId={bookId} />
        )}
      </Authenticated>

      {/* Readers Also Enjoyed */}
      <SimilarBooksSection bookId={bookId} />

      {/* Divider */}
      <div className="editorial-divider my-10">
        <div className="botanical-ornament" />
      </div>

      {/* Reviews */}
      <BookReviewsSection bookId={bookId} />
    </main>
  );
}
