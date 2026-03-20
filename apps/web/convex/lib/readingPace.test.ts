import { describe, it, expect } from "vitest";
import { computeReadingPace } from "./readingPace";
import { DAY_MS } from "./lending";

describe("computeReadingPace", () => {
  const now = Date.now();

  it("returns zero pace when no pages read", () => {
    const result = computeReadingPace(0, 300, now - 3 * DAY_MS, now, null);
    expect(result.pagesPerDay).toBe(0);
    expect(result.estimatedFinishDate).toBeNull();
    expect(result.estimatedDaysLeft).toBeNull();
    expect(result.onTrack).toBeNull();
  });

  it("calculates pace correctly after several days of reading", () => {
    // Read 100 pages in 5 days = 20 pages/day
    const startedAt = now - 5 * DAY_MS;
    const result = computeReadingPace(100, 300, startedAt, now, null);
    expect(result.pagesPerDay).toBe(20);
    // 200 remaining / 20 per day = 10 days
    expect(result.estimatedDaysLeft).toBe(10);
    expect(result.onTrack).toBeNull(); // no deadline
  });

  it("marks on track when estimate is before deadline", () => {
    // 100 pages in 5 days, 200 remaining, ~10 days left
    const startedAt = now - 5 * DAY_MS;
    const deadline = now + 15 * DAY_MS; // plenty of time
    const result = computeReadingPace(100, 300, startedAt, now, deadline);
    expect(result.onTrack).toBe(true);
  });

  it("marks not on track when estimate exceeds deadline", () => {
    // 50 pages in 10 days = 5 pages/day, 250 remaining = 50 days
    const startedAt = now - 10 * DAY_MS;
    const deadline = now + 5 * DAY_MS; // only 5 days left
    const result = computeReadingPace(50, 300, startedAt, now, deadline);
    expect(result.onTrack).toBe(false);
  });

  it("handles book already finished", () => {
    const result = computeReadingPace(300, 300, now - 5 * DAY_MS, now, null);
    expect(result.estimatedDaysLeft).toBe(0);
    expect(result.onTrack).toBe(true);
  });

  it("uses minimum 0.5 day elapsed to avoid spike on first day", () => {
    // Just started 1 hour ago, read 10 pages
    const startedAt = now - 60 * 60 * 1000; // 1 hour
    const result = computeReadingPace(10, 300, startedAt, now, null);
    // 10 pages / 0.5 days = 20 pages/day
    expect(result.pagesPerDay).toBe(20);
  });
});
