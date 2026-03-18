"use client";

import dynamic from "next/dynamic";

const LocationMapInner = dynamic(
  () =>
    import("./location-map-inner").then((mod) => ({
      default: mod.LocationMapInner,
    })),
  { ssr: false, loading: () => <div className="h-[400px] w-full animate-pulse rounded-lg bg-muted" /> },
);

interface Location {
  _id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  currentBookCount: number;
}

interface LocationMapProps {
  locations: Location[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
  className?: string;
}

export function LocationMap(props: LocationMapProps) {
  return <LocationMapInner {...props} />;
}
