"use client";

import { Doc, Id } from "@/convex/_generated/dataModel";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Phone, Mail, Users } from "lucide-react";

export function utilizationPercent(loc: Doc<"partnerLocations">) {
  if (loc.shelfCapacity === 0) return 0;
  return Math.round((loc.currentBookCount / loc.shelfCapacity) * 100);
}

export function LocationDetailDialog({
  location,
  onClose,
  getStaffName,
}: {
  location: Doc<"partnerLocations"> | null;
  onClose: () => void;
  getStaffName: (id: Id<"users">) => string;
}) {
  return (
    <Dialog
      open={location !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {location?.name}
          </DialogTitle>
        </DialogHeader>

        {location && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Address</span>
                <p className="font-medium">{location.address}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Coordinates</span>
                <p className="font-medium">
                  {location.lat.toFixed(4)},{" "}
                  {location.lng.toFixed(4)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Phone</span>
                <p className="ml-1 font-medium">
                  {location.contactPhone}
                </p>
              </div>
              {location.contactEmail && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Email</span>
                  <p className="ml-1 font-medium">
                    {location.contactEmail}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Shelf utilization bar */}
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Shelf Utilization
                </span>
                <span className="font-medium">
                  {location.currentBookCount} /{" "}
                  {location.shelfCapacity}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(utilizationPercent(location), 100)}%`,
                  }}
                />
              </div>
            </div>

            <Separator />

            {/* Manager & Staff */}
            <div>
              <p className="mb-2 text-sm font-medium flex items-center gap-1">
                <Users className="h-4 w-4" /> Manager & Staff
              </p>
              <div className="space-y-1 text-sm">
                <p>
                  <Badge variant="default" className="mr-2">
                    Manager
                  </Badge>
                  {getStaffName(location.managedByUserId)}
                </p>
                {location.staffUserIds.length > 0 ? (
                  location.staffUserIds.map((staffId) => (
                    <p key={staffId}>
                      <Badge variant="secondary" className="mr-2">
                        Staff
                      </Badge>
                      {getStaffName(staffId)}
                    </p>
                  ))
                ) : (
                  <p className="text-muted-foreground">
                    No additional staff members.
                  </p>
                )}
              </div>
            </div>

            {/* Photos */}
            {location.photos.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="mb-2 text-sm font-medium">Photos</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {location.photos.map((photo, i) => (
                      <img
                        key={i}
                        src={photo}
                        alt={`${location.name} photo ${i + 1}`}
                        className="h-24 w-24 rounded-md object-cover"
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div>
              <p className="mb-1 text-sm text-muted-foreground">
                Created{" "}
                {formatDate(location._creationTime)}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
