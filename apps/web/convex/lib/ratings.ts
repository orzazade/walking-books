/**
 * Shared average-rating recalculation used by both book reviews and location reviews.
 */
export function recalcAvgRating(
  currentAvg: number,
  currentCount: number,
  newRating: number,
  oldRating?: number,
): { avgRating: number; reviewCount: number } {
  if (oldRating !== undefined) {
    // Update case: replace old rating, count stays the same
    if (currentCount <= 0) {
      return { avgRating: newRating, reviewCount: currentCount };
    }
    const avg =
      (currentAvg * currentCount - oldRating + newRating) / currentCount;
    return { avgRating: Math.round(avg * 10) / 10, reviewCount: currentCount };
  }
  // Insert case: add new rating, count increments
  const newCount = currentCount + 1;
  const avg = (currentAvg * currentCount + newRating) / newCount;
  return { avgRating: Math.round(avg * 10) / 10, reviewCount: newCount };
}
