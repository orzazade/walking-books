/** Milliseconds in one hour. */
export const HOUR_MS = 60 * 60 * 1000;

/** Milliseconds in one day. */
export const DAY_MS = 24 * HOUR_MS;

/** Grace period (days) when a sharer recalls a checked-out copy. */
export const RECALL_GRACE_DAYS = 7;

/** Reservation expiry window (hours). */
export const RESERVATION_EXPIRY_HOURS = 1;

function getDefaultLendingDays(pageCount: number): number {
  if (pageCount < 200) return 14;
  if (pageCount > 500) return 30;
  return 21;
}

export function getEffectiveLendingDays(
  pageCount: number,
  sharerMaxDays: number | undefined,
): number {
  const systemDefault = getDefaultLendingDays(pageCount);
  if (sharerMaxDays === undefined) return systemDefault;
  return Math.min(systemDefault, sharerMaxDays);
}
