"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Globe,
  Lock,
  BookOpen,
  Trash2,
  User,
  Heart,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { useParams } from "next/navigation";

function CollectionDetail({
  collectionId,
}: {
  collectionId: Id<"collections">;
}) {
  const { isAuthenticated } = useConvexAuth();
  const collection = useQuery(api.collections.getCollection, { collectionId });
  const isFollowing = useQuery(
    api.collections.isFollowing,
    isAuthenticated ? { collectionId } : "skip",
  );
  const followerCount = useQuery(api.collections.followerCount, {
    collectionId,
  });
  const followMut = useMutation(api.collections.follow);
  const unfollowMut = useMutation(api.collections.unfollow);
  const removeBook = useMutation(api.collections.removeBook);
  const [removingBookId, setRemovingBookId] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  async function handleToggleFollow() {
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowMut({ collectionId });
        toast.success("Unfollowed collection");
      } else {
        await followMut({ collectionId });
        toast.success("Following collection");
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update follow"));
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleRemoveBook(bookId: Id<"books">) {
    setRemovingBookId(bookId);
    try {
      await removeBook({ collectionId, bookId });
      toast.success("Book removed from collection");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to remove book"));
    } finally {
      setRemovingBookId(null);
    }
  }

  // Loading
  if (collection === undefined) {
    return (
      <div className="space-y-4">
        <div className="animate-shimmer h-6 w-48 rounded-md bg-muted" />
        <div className="animate-shimmer h-4 w-32 rounded-md bg-muted" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-xl border border-border/40 bg-card/60 p-4"
            >
              <div className="animate-shimmer h-20 w-14 rounded-md bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="animate-shimmer h-4 w-40 rounded-md bg-muted" />
                <div className="animate-shimmer h-3 w-24 rounded-md bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Not found / not authorized
  if (collection === null) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
        <h2 className="font-serif text-lg font-semibold">
          Collection not found
        </h2>
        <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
          This collection may be private or may have been deleted.
        </p>
        <Link
          href="/collections"
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
        >
          Back to collections
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Collection header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-[1.75rem] font-semibold tracking-[-0.01em]">
                {collection.name}
              </h1>
              {collection.isPublic ? (
                <Globe className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {collection.description && (
              <p className="mt-1 text-[0.875rem] text-muted-foreground">
                {collection.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-[0.8125rem] text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {collection.ownerName}
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {collection.books.length}{" "}
                {collection.books.length === 1 ? "book" : "books"}
              </span>
              {followerCount !== undefined && followerCount > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {followerCount}{" "}
                  {followerCount === 1 ? "follower" : "followers"}
                </span>
              )}
            </div>
          </div>

          {/* Follow button — only for public collections the user doesn't own */}
          {collection.isPublic && isAuthenticated && isFollowing !== undefined && (
            <Button
              size="sm"
              variant={isFollowing ? "outline" : "default"}
              onClick={handleToggleFollow}
              disabled={followLoading}
              className="shrink-0"
            >
              <Heart
                className={`mr-1.5 h-3.5 w-3.5 ${isFollowing ? "fill-current" : ""}`}
              />
              {isFollowing ? "Following" : "Follow"}
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {collection.books.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No books in this collection"
          message="Add books from their detail page to grow this collection."
        >
          <Link
            href="/browse"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
          >
            Browse books
          </Link>
        </EmptyState>
      )}

      {/* Book list */}
      {collection.books.length > 0 && (
        <div className="space-y-2">
          {collection.books.map((item) => (
            <div
              key={item.book._id}
              className="group flex items-start gap-3 rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
            >
              {/* Cover */}
              <Link
                href={`/book/${item.book._id}`}
                className="shrink-0"
              >
                {item.book.coverImage ? (
                  <img
                    src={item.book.coverImage}
                    alt={item.book.title}
                    className="h-20 w-14 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-14 items-center justify-center rounded-md bg-muted">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </Link>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <Link href={`/book/${item.book._id}`}>
                  <h3 className="truncate text-[0.9375rem] font-medium hover:underline">
                    {item.book.title}
                  </h3>
                </Link>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {item.book.author}
                </p>
                {item.book.categories.length > 0 && (
                  <span className="mt-1.5 inline-block rounded-md bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                    {item.book.categories[0]}
                  </span>
                )}
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemoveBook(item.book._id)}
                disabled={removingBookId === item.book._id}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove from collection"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CollectionDetailPage() {
  const params = useParams();
  const collectionId = params.id as Id<"collections">;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/collections"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to collections
      </Link>

      <CollectionDetail collectionId={collectionId} />
    </main>
  );
}
