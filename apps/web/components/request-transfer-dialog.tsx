"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowRightLeft, MapPin } from "lucide-react";
import { toast } from "sonner";

export function RequestTransferDialog({
  copyId,
  currentLocationId,
  bookTitle,
}: {
  copyId: Id<"copies">;
  currentLocationId: Id<"partnerLocations">;
  bookTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const locations = useQuery(api.partnerLocations.list);
  const createTransfer = useMutation(api.transferRequests.create);

  const otherLocations = locations?.filter((l) => l._id !== currentLocationId) ?? [];

  async function handleSubmit() {
    if (!selectedLocationId) {
      toast.error("Please select a destination location");
      return;
    }
    setSubmitting(true);
    try {
      await createTransfer({
        copyId,
        toLocationId: selectedLocationId as Id<"partnerLocations">,
        note: note.trim() || undefined,
      });
      toast.success("Transfer request submitted!");
      setOpen(false);
      setSelectedLocationId("");
      setNote("");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to submit request"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded-lg text-[0.75rem]"
          />
        }
      >
        <ArrowRightLeft className="h-3 w-3" />
        <span className="hidden sm:inline">Transfer</span>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Request Transfer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Request &ldquo;{bookTitle}&rdquo; be moved to a location closer to you.
            The partner will review your request.
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Destination
            </label>
            {!locations ? (
              <div className="animate-shimmer h-10 rounded-lg bg-muted" />
            ) : otherLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other locations available.
              </p>
            ) : (
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a location...</option>
                {otherLocations.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name} — {loc.address}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedLocationId && otherLocations.length > 0 && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {otherLocations.find((l) => l._id === selectedLocationId)?.address}
              </span>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Why do you need this transfer?"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={submitting || !selectedLocationId}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting..." : "Request Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
