"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import Link from "next/link";

export function WaitlistPreviewSection() {
  const { isAuthenticated } = useConvexAuth();
  const myWaitlist = useQuery(api.waitlist.myWaitlist, isAuthenticated ? {} : "skip");

  if (!myWaitlist || myWaitlist.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
        <Bell className="h-4.5 w-4.5 text-primary" />
        Waiting For
      </h2>
      <div className="space-y-2.5">
        {myWaitlist.map((entry) => (
          <div
            key={entry._id}
            className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
              entry.status === "notified"
                ? "border-primary/20 bg-primary/5"
                : "border-border/40 bg-card/60"
            }`}
          >
            <div className="flex items-start gap-3">
              {entry.coverImage && (
                <img
                  src={entry.coverImage}
                  alt={entry.title}
                  className="h-14 w-10 shrink-0 rounded object-cover"
                />
              )}
              <div>
                <Link
                  href={`/book/${entry.bookId}`}
                  className="text-[0.875rem] font-medium hover:underline"
                >
                  {entry.title}
                </Link>
                <p className="text-[0.75rem] text-muted-foreground">
                  {entry.author}
                </p>
                <Badge
                  variant={entry.status === "notified" ? "default" : "secondary"}
                  className="mt-1 text-[0.6875rem]"
                >
                  {entry.status === "notified"
                    ? "Copy available!"
                    : `#${entry.position} in queue`}
                </Badge>
              </div>
            </div>
            <Link href={`/book/${entry.bookId}`} className="shrink-0">
              <Button
                size="sm"
                variant={entry.status === "notified" ? "default" : "outline"}
                className="h-7 rounded-lg text-[0.75rem]"
              >
                {entry.status === "notified" ? "View & Reserve" : "View Book"}
              </Button>
            </Link>
          </div>
        ))}
      </div>
      {myWaitlist.length > 3 && (
        <Link
          href="/waitlist"
          className="mt-2 block text-center text-[0.75rem] text-primary hover:underline"
        >
          View all waitlisted books
        </Link>
      )}
    </section>
  );
}
