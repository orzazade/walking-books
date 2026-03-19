"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CONDITION_LABELS, type Condition } from "@/convex/lib/validators";
import { getErrorMessage, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReturnDialog } from "@/components/return-dialog";
import { BookOpen, ArrowUpRight, Undo2 } from "lucide-react";
import { toast } from "sonner";

export function HeldCopiesSection() {
  const heldCopies = useQuery(api.copies.byHolder, {});
  const extendCopy = useMutation(api.copies.extend);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [returnCopyId, setReturnCopyId] = useState<Id<"copies"> | null>(null);

  async function handleAction(id: string, fn: () => Promise<unknown>) {
    setActionLoading(id);
    try {
      await fn();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <>
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
          <BookOpen className="h-4.5 w-4.5 text-primary" />
          Currently Reading
        </h2>
        {heldCopies === undefined ? (
          <div className="animate-shimmer h-4 w-40 rounded-md bg-muted" />
        ) : heldCopies.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/60 p-5 text-center text-[0.8125rem] text-muted-foreground">
            You don&apos;t have any books checked out.{" "}
            <Link href="/browse" className="font-medium text-primary underline underline-offset-2">
              Browse books
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {heldCopies.map((copy) => (
              <div
                key={copy._id}
                className="book-spine flex flex-col gap-3 rounded-xl border border-border/40 bg-card/60 p-4 pl-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/copy/${copy._id}`}
                    className="text-[0.875rem] font-medium hover:underline"
                  >
                    Copy #{copy._id.slice(-6)}
                  </Link>
                  {copy.returnDeadline && (
                    <p className="text-[0.75rem] text-muted-foreground">
                      Due:{" "}
                      {formatDate(copy.returnDeadline)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[0.6875rem]">
                    {CONDITION_LABELS[copy.condition as Condition]}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg text-[0.75rem]"
                    disabled={actionLoading === copy._id}
                    onClick={() =>
                      handleAction(copy._id, async () => {
                        await extendCopy({ copyId: copy._id });
                        toast.success("Lending period extended!");
                      })
                    }
                  >
                    <ArrowUpRight className="mr-1 h-3 w-3" /> Extend
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 rounded-lg text-[0.75rem]"
                    onClick={() => setReturnCopyId(copy._id)}
                  >
                    <Undo2 className="mr-1 h-3 w-3" /> Return
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <ReturnDialog copyId={returnCopyId} onClose={() => setReturnCopyId(null)} />
    </>
  );
}
