"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";

export function WaitlistSection({
  bookId,
}: {
  bookId: Id<"books">;
}) {
  const waitlistPosition = useQuery(api.waitlist.position, { bookId });
  const joinWaitlist = useMutation(api.waitlist.join);
  const leaveWaitlist = useMutation(api.waitlist.leave);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  return (
    <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
      {waitlistPosition ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.875rem] font-medium">
              {waitlistPosition.status === "notified" ? (
                <span className="flex items-center gap-1.5 text-primary">
                  <Bell className="h-4 w-4" />
                  A copy is available for you!
                </span>
              ) : (
                <>You&apos;re #{waitlistPosition.position} on the waitlist</>
              )}
            </p>
            <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
              {waitlistPosition.status === "notified"
                ? "Reserve it before someone else does."
                : "We'll notify you when a copy becomes available."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-[0.75rem]"
            disabled={waitlistLoading}
            onClick={async () => {
              setWaitlistLoading(true);
              try {
                await leaveWaitlist({ bookId });
                toast.success("Removed from waitlist");
              } catch (err: unknown) {
                toast.error(getErrorMessage(err, "Failed to leave waitlist"));
              } finally {
                setWaitlistLoading(false);
              }
            }}
          >
            {waitlistLoading ? "Leaving..." : "Leave Waitlist"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.875rem] font-medium">
              No copies available right now
            </p>
            <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
              Join the waitlist to be notified when a copy is returned.
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 rounded-lg text-[0.75rem]"
            disabled={waitlistLoading}
            onClick={async () => {
              setWaitlistLoading(true);
              try {
                await joinWaitlist({ bookId });
                toast.success("You've joined the waitlist!");
              } catch (err: unknown) {
                toast.error(getErrorMessage(err, "Failed to join waitlist"));
              } finally {
                setWaitlistLoading(false);
              }
            }}
          >
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            {waitlistLoading ? "Joining..." : "Join Waitlist"}
          </Button>
        </div>
      )}
    </div>
  );
}
