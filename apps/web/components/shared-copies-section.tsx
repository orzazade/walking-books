"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type CopyStatus, COPY_STATUS_LABELS } from "@/convex/lib/validators";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function SharedCopiesSection() {
  const sharedCopies = useQuery(api.copies.bySharer, {});
  const recallCopy = useMutation(api.copies.recall);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
        <Share2 className="h-4.5 w-4.5 text-primary" />
        Books I&apos;ve Shared
      </h2>
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
          {sharedCopies.map((copy) => (
            <div
              key={copy._id}
              className="book-spine flex items-center justify-between rounded-xl border border-border/40 bg-card/60 p-4 pl-5"
            >
              <div>
                <Link
                  href={`/copy/${copy._id}`}
                  className="text-[0.875rem] font-medium hover:underline"
                >
                  Copy #{copy._id.slice(-6)}
                </Link>
                <p className="text-[0.75rem] capitalize text-muted-foreground">
                  {copy.ownershipType}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    copy.status === "available" ? "default" : "secondary"
                  }
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
        </div>
      )}
    </section>
  );
}
