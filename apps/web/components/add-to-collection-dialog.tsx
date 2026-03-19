"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FolderPlus, Check, Library } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

export function AddToCollectionDialog({ bookId }: { bookId: Id<"books"> }) {
  const myCollections = useQuery(api.collections.containingBook, { bookId });
  const addToCollection = useMutation(api.collections.addBook);
  const removeFromCollection = useMutation(api.collections.removeBook);
  const [loading, setLoading] = useState<string | null>(null);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-[0.75rem]"
          />
        }
      >
        <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
        Add to Collection
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
        </DialogHeader>
        {myCollections === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-shimmer h-10 rounded-lg bg-muted" />
            ))}
          </div>
        ) : myCollections.length === 0 ? (
          <div className="py-4 text-center">
            <Library className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-[0.8125rem] text-muted-foreground">
              No collections yet
            </p>
            <Link
              href="/collections"
              className="mt-2 inline-block text-[0.8125rem] text-primary hover:underline"
            >
              Create a collection
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {myCollections.map((col) => (
              <button
                key={col._id}
                type="button"
                disabled={loading === col._id}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-50"
                onClick={async () => {
                  setLoading(col._id);
                  try {
                    if (col.containsBook) {
                      await removeFromCollection({ collectionId: col._id, bookId });
                      toast.success(`Removed from "${col.name}"`);
                    } else {
                      await addToCollection({ collectionId: col._id, bookId });
                      toast.success(`Added to "${col.name}"`);
                    }
                  } catch (err: unknown) {
                    toast.error(getErrorMessage(err, "Failed to update collection"));
                  } finally {
                    setLoading(null);
                  }
                }}
              >
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${col.containsBook ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                  {col.containsBook && <Check className="h-3 w-3" />}
                </div>
                <span className="flex-1 truncate text-[0.875rem]">
                  {col.name}
                </span>
                {loading === col._id && (
                  <span className="text-[0.75rem] text-muted-foreground">...</span>
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
