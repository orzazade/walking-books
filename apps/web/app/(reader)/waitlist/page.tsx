"use client";

import { useQuery, useMutation, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Clock, Trash2, BookOpen, Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { getErrorMessage, timeAgo } from "@/lib/utils";

function WaitlistContent() {
  const { isAuthenticated } = useConvexAuth();
  const waitlist = useQuery(api.waitlist.myWaitlist, isAuthenticated ? {} : "skip");
  const leaveWaitlist = useMutation(api.waitlist.leave);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  if (waitlist === undefined) {
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

  if (waitlist.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Your waitlist is empty"
        message="When a book has no available copies, you can join the waitlist to be notified when one becomes available."
      >
        <Link href="/browse">
          <Button className="mt-4 rounded-xl">Browse Books</Button>
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2.5">
      {waitlist.map((entry) => (
        <div
          key={entry._id}
          className="flex gap-4 rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:border-border"
        >
          <Link href={`/book/${entry.bookId}`} className="shrink-0">
            <div className="h-20 w-14 overflow-hidden rounded-lg border border-border/40 bg-muted">
              {entry.coverImage ? (
                <img
                  src={entry.coverImage}
                  alt={entry.title}
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
                href={`/book/${entry.bookId}`}
                className="line-clamp-1 text-[0.875rem] font-medium hover:underline"
              >
                {entry.title}
              </Link>
              <p className="text-[0.75rem] text-muted-foreground">
                {entry.author}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {entry.status === "notified" ? (
                <Badge className="rounded-md bg-primary/10 text-primary border-primary/20 text-[0.6875rem]">
                  <Bell className="mr-1 h-3 w-3" />
                  Copy available!
                </Badge>
              ) : (
                <Badge variant="secondary" className="rounded-md text-[0.6875rem]">
                  #{entry.position} in queue
                </Badge>
              )}
              <span className="text-[0.6875rem] text-muted-foreground">
                Joined {timeAgo(entry.joinedAt)}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 self-center p-0 text-muted-foreground hover:text-destructive"
            disabled={leavingId === entry._id}
            onClick={async () => {
              setLeavingId(entry._id);
              try {
                await leaveWaitlist({ bookId: entry.bookId });
                toast.success("Removed from waitlist");
              } catch (err: unknown) {
                toast.error(getErrorMessage(err, "Failed to leave waitlist"));
              } finally {
                setLeavingId(null);
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

export default function WaitlistPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-8">
        <div className="section-kicker mb-3">Your Library</div>
        <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
          Waitlist
        </h1>
        <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
          Books you're waiting to become available
        </p>
      </div>

      <Authenticated>
        <WaitlistContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to access your waitlist." />
      </Unauthenticated>
    </main>
  );
}
