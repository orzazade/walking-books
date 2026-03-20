import { describe, it, expect } from "vitest";
import { haversineKm } from "./geo";

describe("haversineKm", () => {
  it("returns 0 for same point", () => {
    expect(haversineKm(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it("calculates known distance NYC to LA (~3944 km)", () => {
    const dist = haversineKm(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(3900);
    expect(dist).toBeLessThan(4000);
  });

  it("calculates short distance (<1km)", () => {
    // Two points ~111m apart (0.001 degree latitude ≈ 111m)
    const dist = haversineKm(51.5074, -0.1278, 51.5084, -0.1278);
    expect(dist).toBeGreaterThan(0.1);
    expect(dist).toBeLessThan(0.15);
  });

  it("is symmetric (A→B equals B→A)", () => {
    const ab = haversineKm(48.8566, 2.3522, 51.5074, -0.1278);
    const ba = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(ab).toBeCloseTo(ba, 10);
  });

  it("handles antipodal points (~20000km)", () => {
    // North pole to south pole
    const dist = haversineKm(90, 0, -90, 0);
    expect(dist).toBeGreaterThan(19900);
    expect(dist).toBeLessThan(20100);
  });
});
