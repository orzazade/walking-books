"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CONDITION_LABELS, type Condition } from "@/convex/lib/validators";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function ProfileActivitySection({ userId }: { userId: Id<"users"> }) {
  const journeyEntries = useQuery(api.journeyEntries.byReader, {
    readerId: userId,
  });

  return (
    <section>
      <div className="mb-4">
        <div className="section-kicker mb-2">Activity</div>
        <h2 className="font-serif text-[1.25rem] font-semibold">
          Recent Activity
        </h2>
      </div>
      {journeyEntries === undefined ? (
        <div className="space-y-2">
          <div className="animate-shimmer h-16 rounded-xl bg-muted" />
          <div className="animate-shimmer h-16 rounded-xl bg-muted" />
        </div>
      ) : journeyEntries.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-10 text-center text-[0.8125rem] text-muted-foreground">
          No reading activity yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {journeyEntries
            .slice(-10)
            .reverse()
            .map((entry) => (
              <div
                key={entry._id}
                className="rounded-xl border border-border/40 bg-card/60 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[0.8125rem] font-medium">
                      {entry.returnedAt ? "Returned" : "Picked up"} a book
                    </p>
                    <p className="text-[0.75rem] text-muted-foreground">
                      {formatDate(entry.returnedAt ?? entry.pickedUpAt)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-md text-[0.6875rem]"
                  >
                    {CONDITION_LABELS[(entry.conditionAtReturn ?? entry.conditionAtPickup) as Condition]}
                  </Badge>
                </div>
                {entry.readerNote && (
                  <p className="mt-2 font-serif text-[0.8125rem] italic text-muted-foreground">
                    &ldquo;{entry.readerNote}&rdquo;
                  </p>
                )}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
