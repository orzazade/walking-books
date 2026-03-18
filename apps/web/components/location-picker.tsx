"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LocationMap } from "@/components/location-map";
import { useState } from "react";
import { MapPin } from "lucide-react";

interface LocationPickerProps {
  onSelect: (locationId: string) => void;
  selectedId?: string;
}

export function LocationPicker({ onSelect, selectedId }: LocationPickerProps) {
  const locations = useQuery(api.partnerLocations.list);

  if (locations === undefined) {
    return <div className="h-[300px] animate-pulse rounded-lg bg-muted" />;
  }

  if (locations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No partner locations available yet.
      </p>
    );
  }

  const selected = locations.find((l) => l._id === selectedId);

  return (
    <div className="space-y-3">
      <LocationMap
        locations={locations}
        selectedId={selectedId}
        onSelect={onSelect}
        className="h-[300px] w-full rounded-lg"
      />
      {selected && (
        <div className="flex items-center gap-2 rounded-md border bg-secondary/50 p-3 text-sm">
          <MapPin className="h-4 w-4 text-primary" />
          <div>
            <p className="font-medium">{selected.name}</p>
            <p className="text-muted-foreground">{selected.address}</p>
          </div>
        </div>
      )}
    </div>
  );
}
