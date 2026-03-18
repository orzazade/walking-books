"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MapPin,
  Phone,
  Mail,
  Search,
  Users,
} from "lucide-react";

type LocationDoc = {
  _id: Id<"partnerLocations">;
  _creationTime: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  contactPhone: string;
  contactEmail?: string;
  operatingHours: any;
  photos: string[];
  shelfCapacity: number;
  currentBookCount: number;
  managedByUserId: Id<"users">;
  staffUserIds: Id<"users">[];
};

export default function AdminLocationsPage() {
  const allLocations = useQuery(api.partnerLocations.list);
  const allUsers = useQuery(api.users.listAll);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] =
    useState<LocationDoc | null>(null);

  if (allLocations === undefined || allUsers === undefined) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const filtered = allLocations.filter(
    (loc) =>
      loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.address.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  function getManagerName(managerId: Id<"users">) {
    const user = allUsers?.find((u) => u._id === managerId);
    return user?.name ?? "Unknown";
  }

  function utilizationPercent(loc: LocationDoc) {
    if (loc.shelfCapacity === 0) return 0;
    return Math.round((loc.currentBookCount / loc.shelfCapacity) * 100);
  }

  function utilizationColor(pct: number) {
    if (pct >= 90) return "text-destructive";
    if (pct >= 70) return "text-amber-600";
    return "text-green-600";
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Partner Locations</h1>
        <p className="mt-1 text-muted-foreground">
          {allLocations.length} registered locations
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Location cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              No locations found.
            </CardContent>
          </Card>
        ) : (
          filtered.map((loc) => {
            const pct = utilizationPercent(loc as LocationDoc);
            return (
              <Card
                key={loc._id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => setSelectedLocation(loc as LocationDoc)}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <span className="font-medium truncate">{loc.name}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground truncate">
                      {loc.address}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Manager: {getManagerName(loc.managedByUserId)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        Shelf Usage
                      </p>
                      <p className={`font-bold ${utilizationColor(pct)}`}>
                        {pct}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {loc.currentBookCount} / {loc.shelfCapacity}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Staff</p>
                      <p className="font-bold">{loc.staffUserIds.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Location detail modal */}
      <Dialog
        open={selectedLocation !== null}
        onOpenChange={(open) => !open && setSelectedLocation(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {selectedLocation?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedLocation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Address</span>
                  <p className="font-medium">{selectedLocation.address}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Coordinates</span>
                  <p className="font-medium">
                    {selectedLocation.lat.toFixed(4)},{" "}
                    {selectedLocation.lng.toFixed(4)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Phone</span>
                  <p className="ml-1 font-medium">
                    {selectedLocation.contactPhone}
                  </p>
                </div>
                {selectedLocation.contactEmail && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Email</span>
                    <p className="ml-1 font-medium">
                      {selectedLocation.contactEmail}
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
                    {selectedLocation.currentBookCount} /{" "}
                    {selectedLocation.shelfCapacity}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(utilizationPercent(selectedLocation), 100)}%`,
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
                    {getManagerName(selectedLocation.managedByUserId)}
                  </p>
                  {selectedLocation.staffUserIds.length > 0 ? (
                    selectedLocation.staffUserIds.map((staffId) => (
                      <p key={staffId}>
                        <Badge variant="secondary" className="mr-2">
                          Staff
                        </Badge>
                        {allUsers?.find((u) => u._id === staffId)?.name ??
                          "Unknown"}
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
              {selectedLocation.photos.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-sm font-medium">Photos</p>
                    <div className="flex gap-2 overflow-x-auto">
                      {selectedLocation.photos.map((photo, i) => (
                        <img
                          key={i}
                          src={photo}
                          alt={`${selectedLocation.name} photo ${i + 1}`}
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
                  {new Date(
                    selectedLocation._creationTime,
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
