import { describe, it, expect } from "vitest";
import { getEffectiveLendingDays } from "./lending";

describe("getEffectiveLendingDays", () => {
  it("returns 14 days for short books (<200 pages)", () => {
    expect(getEffectiveLendingDays(150, undefined)).toBe(14);
  });

  it("returns 21 days for medium books (200-500 pages)", () => {
    expect(getEffectiveLendingDays(300, undefined)).toBe(21);
  });

  it("returns 30 days for long books (>500 pages)", () => {
    expect(getEffectiveLendingDays(600, undefined)).toBe(30);
  });

  it("caps at sharer max when sharer sets shorter limit", () => {
    // System default for 300 pages = 21, sharer sets 10
    expect(getEffectiveLendingDays(300, 10)).toBe(10);
  });

  it("uses system default when sharer max is higher", () => {
    // System default for 150 pages = 14, sharer sets 30
    expect(getEffectiveLendingDays(150, 30)).toBe(14);
  });

  it("boundary: exactly 200 pages gets 21 days", () => {
    expect(getEffectiveLendingDays(200, undefined)).toBe(21);
  });

  it("boundary: exactly 500 pages gets 21 days", () => {
    expect(getEffectiveLendingDays(500, undefined)).toBe(21);
  });
});
