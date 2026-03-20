import { describe, it, expect } from "vitest";
import { toDateString, daysBetween } from "./streaks";

describe("toDateString", () => {
  it("formats a timestamp as YYYY-MM-DD in UTC", () => {
    // 2024-06-15T12:00:00Z
    const ts = Date.UTC(2024, 5, 15, 12, 0, 0);
    expect(toDateString(ts)).toBe("2024-06-15");
  });

  it("zero-pads single-digit months and days", () => {
    // 2024-01-05T00:00:00Z
    const ts = Date.UTC(2024, 0, 5, 0, 0, 0);
    expect(toDateString(ts)).toBe("2024-01-05");
  });

  it("handles end-of-year dates", () => {
    const ts = Date.UTC(2024, 11, 31, 23, 59, 59);
    expect(toDateString(ts)).toBe("2024-12-31");
  });
});

describe("daysBetween", () => {
  it("returns 0 for same date", () => {
    expect(daysBetween("2024-06-15", "2024-06-15")).toBe(0);
  });

  it("returns 1 for consecutive days", () => {
    expect(daysBetween("2024-06-15", "2024-06-16")).toBe(1);
  });

  it("returns correct gap across month boundary", () => {
    expect(daysBetween("2024-01-30", "2024-02-02")).toBe(3);
  });

  it("order does not matter (absolute difference)", () => {
    expect(daysBetween("2024-06-20", "2024-06-15")).toBe(5);
  });

  it("handles leap year boundary", () => {
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2); // 2024 is leap year
  });
});
