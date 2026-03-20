import { DAY_MS } from "./lending";

export type ReadingPace = {
  /** Average pages read per day since starting. */
  pagesPerDay: number;
  /** Estimated timestamp when the reader will finish at current pace. null if no progress yet. */
  estimatedFinishDate: number | null;
  /** Whether the reader will likely finish before the return deadline. null if no deadline or can't estimate. */
  onTrack: boolean | null;
  /** Days remaining at current pace. null if no progress yet. */
  estimatedDaysLeft: number | null;
};

/**
 * Compute reading pace from progress data.
 * Pure function — no DB access, fully testable.
 */
export function computeReadingPace(
  currentPage: number,
  totalPages: number,
  startedAt: number,
  now: number,
  returnDeadline: number | null | undefined,
): ReadingPace {
  const pagesRemaining = totalPages - currentPage;

  // If no pages read yet, can't estimate pace
  if (currentPage === 0) {
    return {
      pagesPerDay: 0,
      estimatedFinishDate: null,
      onTrack: null,
      estimatedDaysLeft: null,
    };
  }

  // Calculate elapsed days (minimum 0.5 to avoid division spikes on day one)
  const elapsedMs = Math.max(now - startedAt, 0);
  const elapsedDays = Math.max(elapsedMs / DAY_MS, 0.5);

  const pagesPerDay = Math.round((currentPage / elapsedDays) * 10) / 10;

  if (pagesRemaining <= 0) {
    // Already finished
    return {
      pagesPerDay,
      estimatedFinishDate: now,
      onTrack: true,
      estimatedDaysLeft: 0,
    };
  }

  const estimatedDaysLeft = Math.ceil(pagesRemaining / pagesPerDay);
  const estimatedFinishDate = now + estimatedDaysLeft * DAY_MS;

  let onTrack: boolean | null = null;
  if (returnDeadline) {
    onTrack = estimatedFinishDate <= returnDeadline;
  }

  return {
    pagesPerDay,
    estimatedFinishDate,
    onTrack,
    estimatedDaysLeft,
  };
}
