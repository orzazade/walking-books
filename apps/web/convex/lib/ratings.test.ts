import { describe, it, expect } from "vitest";
import { recalcAvgRating } from "./ratings";

describe("recalcAvgRating", () => {
  it("calculates correct average for first review (insert)", () => {
    const result = recalcAvgRating(0, 0, 4);
    expect(result.avgRating).toBe(4);
    expect(result.reviewCount).toBe(1);
  });

  it("calculates correct average for second review (insert)", () => {
    // Existing: avg 4, count 1. New rating: 2. Expected: (4+2)/2 = 3
    const result = recalcAvgRating(4, 1, 2);
    expect(result.avgRating).toBe(3);
    expect(result.reviewCount).toBe(2);
  });

  it("rounds to one decimal place", () => {
    // Existing: avg 4, count 2 (total 8). New rating: 5. Expected: 13/3 = 4.333... → 4.3
    const result = recalcAvgRating(4, 2, 5);
    expect(result.avgRating).toBe(4.3);
    expect(result.reviewCount).toBe(3);
  });

  it("recalculates correctly on update (replace old rating)", () => {
    // Existing: avg 3.5, count 2 (total 7). Old rating: 3, new: 5.
    // New total = 7 - 3 + 5 = 9. Avg = 9/2 = 4.5
    const result = recalcAvgRating(3.5, 2, 5, 3);
    expect(result.avgRating).toBe(4.5);
    expect(result.reviewCount).toBe(2); // count unchanged on update
  });

  it("handles update when count is zero gracefully", () => {
    // Edge case: count somehow 0 with an update
    const result = recalcAvgRating(0, 0, 4, 2);
    expect(result.avgRating).toBe(4);
    expect(result.reviewCount).toBe(0);
  });

  it("handles perfect 5-star ratings", () => {
    const result = recalcAvgRating(5, 3, 5);
    expect(result.avgRating).toBe(5);
    expect(result.reviewCount).toBe(4);
  });
});
