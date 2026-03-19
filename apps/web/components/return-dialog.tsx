"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { CONDITIONS, CONDITION_LABELS, type Condition } from "@/convex/lib/validators";

export function ReturnDialog({
  copyId,
  onClose,
}: {
  copyId: Id<"copies"> | null;
  onClose: () => void;
}) {
  const locations = useQuery(api.partnerLocations.list, copyId ? {} : "skip");
  const returnCopy = useMutation(api.copies.returnCopy);

  const [locationId, setLocationId] = useState<string>("");
  const [condition, setCondition] = useState<Condition>("good");
  const [note, setNote] = useState("");
  const [returning, setReturning] = useState(false);

  function handleClose() {
    onClose();
    setLocationId("");
    setCondition("good");
    setNote("");
  }

  async function handleReturn() {
    if (!copyId || !locationId) return;
    setReturning(true);
    try {
      const result = await returnCopy({
        copyId,
        locationId: locationId as Id<"partnerLocations">,
        conditionAtReturn: condition,
        photos: [],
        readerNote: note.trim() || undefined,
      });
      const repChange = result.reputationChange;
      const sign = repChange >= 0 ? "+" : "";
      toast.success(`Book returned! Reputation ${sign}${repChange}`);
      handleClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setReturning(false);
    }
  }

  return (
    <Dialog open={copyId !== null} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Return Book</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[0.8125rem] font-medium">
              Return Location
            </label>
            {locations === undefined ? (
              <div className="animate-shimmer h-4 w-32 rounded-md bg-muted" />
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {locations.map((loc) => (
                  <button
                    key={loc._id}
                    type="button"
                    onClick={() => setLocationId(loc._id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border p-3 text-left text-[0.8125rem] transition-colors ${
                      locationId === loc._id
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:bg-muted"
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">{loc.name}</p>
                      <p className="text-[0.75rem] text-muted-foreground">
                        {loc.address}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[0.8125rem] font-medium">
              Book Condition
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={`rounded-lg border px-3 py-2 text-[0.8125rem] transition-colors ${
                    condition === c
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border/50 hover:bg-muted"
                  }`}
                >
                  {CONDITION_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[0.8125rem] font-medium">
              Note (optional)
            </label>
            <Textarea
              placeholder="Leave a note for the next reader..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="rounded-lg text-[0.8125rem]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            className="rounded-lg"
            onClick={handleReturn}
            disabled={!locationId || returning}
          >
            {returning ? "Returning..." : "Confirm Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
