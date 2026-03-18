"use client";

import { useQuery, useMutation, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Trash2, BookOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

function WishlistContent() {
  const { isAuthenticated } = useConvexAuth();
  const wishlist = useQuery(api.wishlist.myWishlist, isAuthenticated ? {} : "skip");
  const toggleWishlist = useMutation(api.wishlist.toggle);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (wishlist === undefined) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-shimmer h-24 rounded-xl bg-muted"
          />
        ))}
      </div>
    );
  }

  if (wishlist.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <Heart className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-lg font-semibold">
          Your wishlist is empty
        </h2>
        <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
          Browse books and tap the heart to save them for later.
        </p>
        <Link href="/browse">
          <Button className="mt-4 rounded-xl">Browse Books</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {wishlist.map((entry) => (
        <div
          key={entry._id}
          className="flex gap-4 rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:border-border"
        >
          <Link href={`/book/${entry.book._id}`} className="shrink-0">
            <div className="h-20 w-14 overflow-hidden rounded-lg border border-border/40 bg-muted">
              {entry.book.coverImage ? (
                <img
                  src={entry.book.coverImage}
                  alt={entry.book.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <BookOpen className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </div>
          </Link>

          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div>
              <Link
                href={`/book/${entry.book._id}`}
                className="line-clamp-1 text-[0.875rem] font-medium hover:underline"
              >
                {entry.book.title}
              </Link>
              <p className="text-[0.75rem] text-muted-foreground">
                {entry.book.author}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={entry.availableCount > 0 ? "default" : "secondary"}
                className="rounded-md text-[0.6875rem]"
              >
                {entry.availableCount > 0
                  ? `${entry.availableCount} available`
                  : "Unavailable"}
              </Badge>
              <span className="text-[0.6875rem] text-muted-foreground">
                Added {new Date(entry.addedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 self-center p-0 text-muted-foreground hover:text-destructive"
            disabled={removingId === entry._id}
            onClick={async () => {
              setRemovingId(entry._id);
              try {
                await toggleWishlist({ bookId: entry.bookId });
                toast.success("Removed from wishlist");
              } catch {
                toast.error("Failed to remove");
              } finally {
                setRemovingId(null);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function WishlistPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-8">
        <div className="section-kicker mb-3">Your Library</div>
        <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
          Wishlist
        </h1>
        <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
          Books you want to read next
        </p>
      </div>

      <Authenticated>
        <WishlistContent />
      </Authenticated>
      <Unauthenticated>
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <p className="text-[0.875rem] text-muted-foreground">
            Sign in to access your wishlist.
          </p>
          <SignInButton mode="modal">
            <Button className="mt-4 rounded-xl">Sign In</Button>
          </SignInButton>
        </div>
      </Unauthenticated>
    </main>
  );
}
