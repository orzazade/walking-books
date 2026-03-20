"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type CopyStatus, COPY_STATUS_LABELS } from "@/convex/lib/validators";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, RotateCcw, BookOpen, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const MAX_PREVIEW = 4;

export function SharedCopiesSection() {
  const sharedCopies = useQuery(api.copies.bySharerEnriched, {});
  const recallCopy = useMutation(api.copies.recall);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const preview = sharedCopies?.slice(0, MAX_PREVIEW);
  const hasMore = (sharedCopies?.length ?? 0) > MAX_PREVIEW;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
          <Share2 className="h-4.5 w-4.5 text-primary" />
          Books I&apos;ve Shared
        </h2>
        {sharedCopies && sharedCopies.length > 0 && (
          <Link
            href="/my-books"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {sharedCopies === undefined ? (
        <div className="animate-shimmer h-4 w-40 rounded-md bg-muted" />
      ) : sharedCopies.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-card/60 p-5 text-center text-[0.8125rem] text-muted-foreground">
          You haven&apos;t shared any books yet.{" "}
          <Link href="/share" className="font-medium text-primary underline underline-offset-2">
            Share a book
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {preview!.map((copy) => (
            <div
              key={copy._id}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
            >
              <Link href={`/book/${copy.bookId}`} className="shrink-0">
                {copy.coverImage ? (
                  <img
                    src={copy.coverImage}
                    alt={copy.bookTitle}
                    className="h-12 w-8 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-8 items-center justify-center rounded-md bg-muted">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/book/${copy.bookId}`}
                  className="text-sm font-medium leading-tight hover:underline"
                >
                  {copy.bookTitle}
                </Link>
                <p className="text-xs text-muted-foreground">{copy.bookAuthor}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant={copy.status === "available" ? "default" : "secondary"}
                  className="text-[0.6875rem]"
                >
                  {COPY_STATUS_LABELS[copy.status as CopyStatus]}
                </Badge>
                {copy.ownershipType === "lent" &&
                  (copy.status === "available" ||
                    copy.status === "checked_out") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-lg text-[0.75rem]"
                      disabled={actionLoading === `recall-${copy._id}`}
                      onClick={async () => {
                        setActionLoading(`recall-${copy._id}`);
                        try {
                          await recallCopy({ copyId: copy._id });
                          toast.success("Copy recall initiated.");
                        } catch (err: unknown) {
                          toast.error(getErrorMessage(err, "Something went wrong"));
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" /> Recall
                    </Button>
                  )}
              </div>
            </div>
          ))}
          {hasMore && (
            <Link
              href="/my-books"
              className="block rounded-xl border border-border/40 bg-card/60 p-3 text-center text-xs font-medium text-primary transition-colors hover:bg-card/80"
            >
              See all {sharedCopies.length} shared books
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
