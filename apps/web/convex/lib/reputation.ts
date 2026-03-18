export const REPUTATION = {
  RETURN_ON_TIME: 3,
  GOOD_CONDITION: 2,
  LEAVE_NOTE: 1,
  LATE_RETURN: -5,
  NO_SHOW: -3,
  OVERDUE_DAILY: -1,
} as const;

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

export function getUserRestrictions(score: number) {
  if (score < 15)
    return { canReserve: false, maxBooks: 0, tier: "suspended" as const };
  if (score < 30)
    return { canReserve: true, maxBooks: 1, tier: "restricted" as const };
  if (score < 50)
    return { canReserve: true, maxBooks: 10, tier: "warning" as const };
  return { canReserve: true, maxBooks: 10, tier: "full" as const };
}
