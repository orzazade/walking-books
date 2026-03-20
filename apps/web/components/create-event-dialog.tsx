"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { EVENT_TYPE_LABELS, type EventType } from "@/convex/lib/validators";

const EVENT_TYPES = Object.entries(EVENT_TYPE_LABELS) as [EventType, string][];

export function CreateEventDialog({
  locationId,
}: {
  locationId: Id<"partnerLocations">;
}) {
  const createEvent = useMutation(api.locationEvents.create);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("reading_meetup");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState("");

  function reset() {
    setTitle("");
    setDescription("");
    setEventType("reading_meetup");
    setDate("");
    setStartTime("");
    setEndTime("");
    setCapacity("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !description.trim() || !date || !startTime || !endTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    const startsAt = new Date(`${date}T${startTime}`).getTime();
    const endsAt = new Date(`${date}T${endTime}`).getTime();

    if (isNaN(startsAt) || isNaN(endsAt)) {
      toast.error("Invalid date or time");
      return;
    }

    if (endsAt <= startsAt) {
      toast.error("End time must be after start time");
      return;
    }

    const capNum = capacity ? parseInt(capacity, 10) : undefined;
    if (capacity && (isNaN(capNum!) || capNum! < 1 || capNum! > 1000)) {
      toast.error("Capacity must be between 1 and 1000");
      return;
    }

    setLoading(true);
    try {
      await createEvent({
        locationId,
        title: title.trim(),
        description: description.trim(),
        eventType,
        startsAt,
        endsAt,
        capacity: capNum,
      });
      toast.success("Event created!");
      reset();
      setOpen(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create event"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2" />
        }
      >
        <CalendarPlus className="h-4 w-4" /> Create Event
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Create Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly Book Club Meeting"
              maxLength={200}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Description *</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this event about?"
              rows={3}
              maxLength={2000}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Event Type *</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {EVENT_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Date *</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Start Time *</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">End Time *</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Capacity <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Leave empty for unlimited"
              min={1}
              max={1000}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
