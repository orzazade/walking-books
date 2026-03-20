"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage, formatDate } from "@/lib/utils";
import {
  ArrowRightLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  MapPin,
  X,
  XCircle,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    icon: Clock,
    className:
      "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  accepted: {
    label: "Accepted",
    icon: CheckCircle2,
    className:
      "border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className:
      "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    className:
      "border-border bg-muted text-muted-foreground",
  },
} as const;

function PendingSection() {
  const requests = useQuery(api.transferRequests.myRequests, {});
  const cancelRequest = useMutation(api.transferRequests.cancel);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const pending = requests?.filter((r) => r.status === "pending");

  if (requests === undefined) {
    return (
      <div className="space-y-2.5">
        {[1, 2].map((i) => (
          <div key={i} className="animate-shimmer h-24 rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!pending || pending.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/60 p-5 text-center text-[0.8125rem] text-muted-foreground">
        No pending transfer requests.
      </div>
    );
  }

  async function handleCancel(requestId: Id<"transferRequests">) {
    setCancellingId(requestId);
    try {
      await cancelRequest({ requestId });
      toast.success("Transfer request cancelled.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to cancel request"));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-2.5">
      {pending.map((req) => (
        <div
          key={req._id}
          className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
        >
          <div className="flex gap-3">
            <Link href={`/book/${req.bookId}`} className="shrink-0">
              {req.coverImage ? (
                <img
                  src={req.coverImage}
                  alt={req.bookTitle}
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
                    href={`/book/${req.bookId}`}
                    className="text-sm font-medium leading-tight hover:underline"
                  >
                    {req.bookTitle}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {req.bookAuthor}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {req.fromLocationName}
                    </span>
                    <ArrowRightLeft className="h-3 w-3 shrink-0 text-primary" />
                    <span className="truncate">
                      {req.toLocationName}
                    </span>
                  </div>
                  {req.note && (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                      &ldquo;{req.note}&rdquo;
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Requested {formatDate(req.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`shrink-0 gap-1 ${STATUS_CONFIG.pending.className}`}
                  >
                    <Clock className="h-3 w-3" />
                    Pending
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg text-xs"
                    disabled={cancellingId === req._id}
                    onClick={() => handleCancel(req._id as Id<"transferRequests">)}
                  >
                    <X className="mr-1 h-3 w-3" /> Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResolvedSection() {
  const requests = useQuery(api.transferRequests.myRequests, {});

  const resolved = requests?.filter((r) => r.status !== "pending");

  if (requests === undefined) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-shimmer h-20 rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!resolved || resolved.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/60 p-5 text-center text-[0.8125rem] text-muted-foreground">
        No resolved transfer requests yet.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {resolved.map((req) => {
        const config = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG];
        const StatusIcon = config?.icon ?? Clock;

        return (
          <div
            key={req._id}
            className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
          >
            <div className="flex gap-3">
              <Link href={`/book/${req.bookId}`} className="shrink-0">
                {req.coverImage ? (
                  <img
                    src={req.coverImage}
                    alt={req.bookTitle}
                    className="h-16 w-11 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-11 items-center justify-center rounded-md bg-muted">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/book/${req.bookId}`}
                      className="text-sm font-medium leading-tight hover:underline"
                    >
                      {req.bookTitle}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {req.bookAuthor}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {req.fromLocationName}
                      </span>
                      <ArrowRightLeft className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate">
                        {req.toLocationName}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested {formatDate(req.createdAt)}
                    </p>
                  </div>

                  {config && (
                    <Badge
                      variant="outline"
                      className={`shrink-0 gap-1 ${config.className}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransferRequestsContent() {
  const requests = useQuery(api.transferRequests.myRequests, {});

  const pendingCount = requests?.filter((r) => r.status === "pending").length ?? 0;
  const acceptedCount = requests?.filter((r) => r.status === "accepted").length ?? 0;
  const totalCount = requests?.length ?? 0;

  return (
    <div className="space-y-8">
      {/* Summary stats */}
      {requests !== undefined && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
            <p className="text-2xl font-semibold font-serif">{pendingCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
            <p className="text-2xl font-semibold font-serif">{acceptedCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Accepted</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/60 p-4 text-center">
            <p className="text-2xl font-semibold font-serif">{totalCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">All Time</p>
          </div>
        </div>
      )}

      {/* Pending requests */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-semibold">
          <Clock className="h-4.5 w-4.5 text-primary" />
          Pending Requests
        </h2>
        <PendingSection />
      </section>

      {/* Resolved requests */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-semibold">
          <ArrowRightLeft className="h-4.5 w-4.5 text-muted-foreground" />
          Past Requests
        </h2>
        <ResolvedSection />
      </section>
    </div>
  );
}

export default function TransferRequestsPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-8">
        <div className="section-kicker mb-3">Your Library</div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Transfer Requests
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Track books you&apos;ve requested to be moved closer to you
        </p>
      </div>

      <Authenticated>
        <TransferRequestsContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see your transfer requests." />
      </Unauthenticated>
    </main>
  );
}
