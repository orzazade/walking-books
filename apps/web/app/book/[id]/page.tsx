"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/star-rating";
import { getErrorMessage } from "@/lib/utils";
import { AddToCollectionDialog } from "@/components/add-to-collection-dialog";
import { BookReviewsSection } from "@/components/book-reviews-section";
import { BookCopiesSection } from "@/components/book-copies-section";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { SimilarBooksSection } from "@/components/similar-books-section";
import { WaitlistSection } from "@/components/waitlist-section";
import { BookOpen, Heart } from "lucide-react";

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as Id<"books">;

  const book = useQuery(api.books.byId, { bookId });
  const copies = useQuery(api.copies.byBook, { bookId });
  const isWishlisted = useQuery(api.wishlist.isWishlisted, { bookId });
  const toggleWishlist = useMutation(api.wishlist.toggle);

  const [togglingWishlist, setTogglingWishlist] = useState(false);

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
      <BookCopiesSection bookId={bookId} />

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
