"use client";

import dynamic from "next/dynamic";
import type { LocationMapInnerProps } from "./location-map-inner";

const LocationMapInner = dynamic(
  () =>
    import("./location-map-inner").then((mod) => ({
      default: mod.LocationMapInner,
    })),
  { ssr: false, loading: () => <div className="h-[400px] w-full animate-pulse rounded-lg bg-muted" /> },
);

export function LocationMap(props: LocationMapInnerProps) {
  return <LocationMapInner {...props} />;
}
