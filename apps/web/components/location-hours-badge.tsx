"use client";

import { getHoursStatus } from "@/lib/locationHours";

/**
 * Compact badge showing a location's open/closed status.
 * Renders nothing if operatingHours is missing or unparseable.
 */
export function LocationHoursBadge({
  operatingHours,
}: {
  operatingHours: Record<string, string> | null | undefined;
}) {
  const status = getHoursStatus(operatingHours);
  if (!status) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[0.6875rem] ${
        status.isOpen
          ? "text-green-600 dark:text-emerald-500"
          : "text-muted-foreground"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          status.isOpen ? "bg-green-500 dark:bg-emerald-500" : "bg-muted-foreground/50"
        }`}
      />
      {status.label}
    </span>
  );
}
