import { describe, it, expect } from "vitest";
import { getHoursStatus } from "./locationHours";

const WEEKDAY_HOURS = {
  mon: "09:00-18:00",
  tue: "09:00-18:00",
  wed: "09:00-18:00",
  thu: "09:00-18:00",
  fri: "09:00-22:00",
  sat: "10:00-16:00",
};

describe("getHoursStatus", () => {
  it("returns null for missing or null hours", () => {
    expect(getHoursStatus(null)).toBeNull();
    expect(getHoursStatus(undefined)).toBeNull();
  });

  it("reports open when within operating hours", () => {
    // Wednesday at 14:00
    const wed2pm = new Date("2026-03-18T14:00:00");
    const status = getHoursStatus(WEEKDAY_HOURS, wed2pm);
    expect(status).not.toBeNull();
    expect(status!.isOpen).toBe(true);
    expect(status!.label).toBe("Open until 6 PM");
    expect(status!.todayHours).toBe("9 AM – 6 PM");
  });

  it("reports closed before opening time with today's open time", () => {
    // Tuesday at 07:30
    const tue730am = new Date("2026-03-17T07:30:00");
    const status = getHoursStatus(WEEKDAY_HOURS, tue730am);
    expect(status).not.toBeNull();
    expect(status!.isOpen).toBe(false);
    expect(status!.label).toBe("Opens 9 AM");
  });

  it("reports closed after hours with next day info", () => {
    // Friday at 23:00 (after 22:00 close)
    const fri11pm = new Date("2026-03-20T23:00:00");
    const status = getHoursStatus(WEEKDAY_HOURS, fri11pm);
    expect(status).not.toBeNull();
    expect(status!.isOpen).toBe(false);
    expect(status!.label).toContain("Opens");
    expect(status!.label).toContain("10 AM"); // Saturday opens 10 AM
  });

  it("reports closed on a day with no hours and finds next open day", () => {
    // Sunday (no hours in WEEKDAY_HOURS)
    const sun = new Date("2026-03-22T12:00:00");
    const status = getHoursStatus(WEEKDAY_HOURS, sun);
    expect(status).not.toBeNull();
    expect(status!.isOpen).toBe(false);
    expect(status!.label).toContain("Opens");
    expect(status!.label).toContain("tomorrow"); // Sunday → Monday is tomorrow
    expect(status!.todayHours).toBeNull();
  });

  it("handles midnight closing time (00:00)", () => {
    const hours = { fri: "18:00-00:00" };
    const fri9pm = new Date("2026-03-20T21:00:00"); // Friday
    const status = getHoursStatus(hours, fri9pm);
    expect(status).not.toBeNull();
    expect(status!.isOpen).toBe(true);
    expect(status!.label).toBe("Open until 12 AM");
  });
});
