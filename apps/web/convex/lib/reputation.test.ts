import { describe, it, expect } from "vitest";
import {
  calculateReturnRepChange,
  clampScore,
  getUserRestrictions,
  REPUTATION,
} from "./reputation";

describe("calculateReturnRepChange", () => {
  it("on-time return with good condition gives +5", () => {
    const change = calculateReturnRepChange({
      isOnTime: true,
      condition: "good",
      hasNote: false,
    });
    expect(change).toBe(REPUTATION.RETURN_ON_TIME + REPUTATION.GOOD_CONDITION); // 3+2=5
  });

  it("late return with poor condition gives -5", () => {
    const change = calculateReturnRepChange({
      isOnTime: false,
      condition: "fair",
      hasNote: false,
    });
    expect(change).toBe(REPUTATION.LATE_RETURN); // -5
  });

  it("leaving a note adds +1 bonus", () => {
    const withNote = calculateReturnRepChange({
      isOnTime: true,
      condition: "good",
      hasNote: true,
    });
    const withoutNote = calculateReturnRepChange({
      isOnTime: true,
      condition: "good",
      hasNote: false,
    });
    expect(withNote - withoutNote).toBe(REPUTATION.LEAVE_NOTE); // +1
  });

  it("like_new condition also earns condition bonus", () => {
    const change = calculateReturnRepChange({
      isOnTime: true,
      condition: "like_new",
      hasNote: false,
    });
    expect(change).toBe(REPUTATION.RETURN_ON_TIME + REPUTATION.GOOD_CONDITION); // 3+2=5
  });
});

describe("clampScore", () => {
  it("clamps below 0 to 0", () => {
    expect(clampScore(-10)).toBe(0);
  });

  it("clamps above 100 to 100", () => {
    expect(clampScore(150)).toBe(100);
  });

  it("passes through normal values", () => {
    expect(clampScore(50)).toBe(50);
  });
});

describe("getUserRestrictions", () => {
  it("suspends users below 15", () => {
    const r = getUserRestrictions(10);
    expect(r.canReserve).toBe(false);
    expect(r.tier).toBe("suspended");
  });

  it("restricts users 15-29 to 1 book", () => {
    const r = getUserRestrictions(20);
    expect(r.canReserve).toBe(true);
    expect(r.maxBooks).toBe(1);
    expect(r.tier).toBe("restricted");
  });

  it("warns users 30-49", () => {
    const r = getUserRestrictions(40);
    expect(r.tier).toBe("warning");
    expect(r.maxBooks).toBe(10);
  });

  it("gives full access at 50+", () => {
    const r = getUserRestrictions(75);
    expect(r.tier).toBe("full");
    expect(r.maxBooks).toBe(10);
  });

  it("boundary: score 15 is restricted not suspended", () => {
    expect(getUserRestrictions(15).tier).toBe("restricted");
  });

  it("boundary: score 30 is warning not restricted", () => {
    expect(getUserRestrictions(30).tier).toBe("warning");
  });

  it("boundary: score 50 is full not warning", () => {
    expect(getUserRestrictions(50).tier).toBe("full");
  });
});
