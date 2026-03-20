"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type CopyStatus, type Condition, COPY_STATUS_LABELS, CONDITION_LABELS } from "@/convex/lib/validators";
import { getErrorMessage } from "@/lib/utils";
import {
  BookOpen,
  MapPin,
  Share2,
  RotateCcw,
  History,
  User,
  Plus,
  BookCopy,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  available: "border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
  checked_out: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
  reserved: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400",
  recalled: "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-400",
  retired: "border-border bg-muted text-muted-foreground",
};

function MyBooksContent() {
  const copies = useQuery(api.copies.bySharerEnriched, {});
  const recallCopy = useMutation(api.copies.recall);
  const relistCopy = useMutation(api.copies.relist);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (copies === undefined) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-shimmer h-24 rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  const availableCount = copies.filter((c) => c.status === "available").length;
  const checkedOutCount = copies.filter((c) => c.status === "checked_out").length;
  const lentCount = copies.filter((c) => c.ownershipType === "lent").length;

  if (copies.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/60 p-8 text-center">
        <BookCopy className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <p className="mt-3 text-sm text-muted-foreground">
          You haven&apos;t shared any books yet.
        </p>
        <Link href="/share">
          <Button size="sm" className="mt-4 rounded-lg">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Share Your First Book
          </Button>
        </Link>
      </div>
    );
  }

  async function handleRelist(copyId: string) {
    setActionLoading(`relist-${copyId}`);
    try {
      await relistCopy({ copyId: copyId as Parameters<typeof relistCopy>[0]["copyId"] });
      toast.success("Copy is now available for lending again.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRecall(copyId: string) {
    setActionLoading(`recall-${copyId}`);
    try {
      await recallCopy({ copyId: copyId as Parameters<typeof recallCopy>[0]["copyId"] });
      toast.success("Copy recall initiated.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
          <p className="text-2xl font-semibold font-serif">{copies.length}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Total Shared</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
          <p className="text-2xl font-semibold font-serif">{availableCount}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Available</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
          <p className="text-2xl font-semibold font-serif">{checkedOutCount}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Checked Out</p>
        </div>
      </div>

      {/* Books list */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
            <BookCopy className="h-4.5 w-4.5 text-primary" />
            Your Books ({copies.length})
          </h2>
          <Link href="/share">
            <Button variant="outline" size="sm" className="h-7 rounded-lg text-xs">
              <Plus className="mr-1 h-3 w-3" /> Share Another
            </Button>
          </Link>
        </div>

        <div className="space-y-2.5">
          {copies.map((copy) => (
            <div
              key={copy._id}
              className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
            >
              <div className="flex gap-3">
                <Link href={`/book/${copy.bookId}`} className="shrink-0">
                  {copy.coverImage ? (
                    <img
                      src={copy.coverImage}
                      alt={copy.bookTitle}
                      className="h-16 w-11 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-11 items-center justify-center rounded-md bg-muted">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/book/${copy.bookId}`}
                        className="text-sm font-medium leading-tight hover:underline"
                      >
                        {copy.bookTitle}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {copy.bookAuthor}
                      </p>

                      {copy.locationName && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{copy.locationName}</span>
                        </div>
                      )}

                      {copy.status === "checked_out" && copy.holderName && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" />
                          <span>With {copy.holderName}</span>
                          {copy.returnDeadline && (
                            <span className="text-muted-foreground/70">
                              &middot; Due {new Date(copy.returnDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[0.6875rem] ${STATUS_STYLE[copy.status] ?? ""}`}
                        >
                          {COPY_STATUS_LABELS[copy.status as CopyStatus]}
                        </Badge>
                        <Badge variant="outline" className="text-[0.6875rem] capitalize">
                          {copy.ownershipType}
                        </Badge>
                        <Badge variant="outline" className="text-[0.6875rem]">
                          {CONDITION_LABELS[copy.condition as Condition]}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/copy/${copy._id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-lg text-xs"
                        >
                          <History className="mr-1 h-3 w-3" /> History
                        </Button>
                      </Link>
                      {copy.ownershipType === "lent" &&
                        (copy.status === "available" || copy.status === "checked_out" || copy.status === "reserved") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 rounded-lg text-xs"
                            disabled={actionLoading === `recall-${copy._id}`}
                            onClick={() => handleRecall(copy._id)}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" /> Recall
                          </Button>
                        )}
                      {copy.status === "recalled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-lg text-xs"
                          disabled={actionLoading === `relist-${copy._id}`}
                          onClick={() => handleRelist(copy._id)}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Relist
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lending summary */}
      {lentCount > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-semibold">
            <CheckCircle2 className="h-4.5 w-4.5 text-muted-foreground" />
            Lending Summary
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
              <p className="text-2xl font-semibold font-serif">{lentCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Lent Copies</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
              <p className="text-2xl font-semibold font-serif">
                {copies.filter((c) => c.ownershipType === "donated").length}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Donated Copies</p>
            </div>
          </div>
        </section>
      )}

      {/* Link to sharer stats */}
      <div className="rounded-xl border border-border/40 bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Want detailed analytics on your shared books?
            </span>
          </div>
          <Link href="/sharer-stats">
            <Button variant="outline" size="sm" className="h-7 rounded-lg text-xs">
              View Stats
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function MyBooksPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-8">
        <div className="section-kicker mb-3">Your Library</div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          My Shared Books
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Track and manage every book you&apos;ve shared with the community
        </p>
      </div>

      <Authenticated>
        <MyBooksContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see your shared books." />
      </Unauthenticated>
    </main>
  );
}
