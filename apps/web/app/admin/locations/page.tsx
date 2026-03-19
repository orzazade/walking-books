"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LocationDetailDialog, utilizationPercent } from "@/components/location-detail-dialog";
import {
  MapPin,
  Search,
} from "lucide-react";

function utilizationColor(pct: number) {
  if (pct >= 90) return "text-destructive";
  if (pct >= 70) return "text-amber-600";
  return "text-green-600";
}

export default function AdminLocationsPage() {
  const allLocations = useQuery(api.partnerLocations.list);
  const allUsers = useQuery(api.users.listAll);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] =
    useState<Doc<"partnerLocations"> | null>(null);

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
            const pct = utilizationPercent(loc);
            return (
              <Card
                key={loc._id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => setSelectedLocation(loc)}
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

      <LocationDetailDialog
        location={selectedLocation}
        onClose={() => setSelectedLocation(null)}
        getStaffName={getManagerName}
      />
    </>
  );
}
