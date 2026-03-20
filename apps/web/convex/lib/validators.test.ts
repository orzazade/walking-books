import { describe, it, expect } from "vitest";
import { validatePhotos } from "./validators";

describe("validatePhotos", () => {
  it("accepts valid HTTP URLs", () => {
    expect(() =>
      validatePhotos(["https://example.com/photo.jpg", "http://cdn.test.com/img.png"]),
    ).not.toThrow();
  });

  it("accepts empty array", () => {
    expect(() => validatePhotos([])).not.toThrow();
  });

  it("rejects more than 20 photos", () => {
    const photos = Array.from({ length: 21 }, (_, i) => `https://example.com/${i}.jpg`);
    expect(() => validatePhotos(photos)).toThrow("Maximum 20 photos allowed");
  });

  it("rejects URLs longer than 2000 characters", () => {
    const longUrl = "https://example.com/" + "a".repeat(2000);
    expect(() => validatePhotos([longUrl])).toThrow("2000 characters or less");
  });

  it("rejects non-HTTP URLs (XSS prevention)", () => {
    expect(() => validatePhotos(["javascript:alert(1)"])).toThrow(
      "Photo URLs must start with http:// or https://",
    );
  });

  it("rejects data: URIs", () => {
    expect(() => validatePhotos(["data:image/png;base64,abc"])).toThrow(
      "Photo URLs must start with http:// or https://",
    );
  });

  it("rejects empty string URLs", () => {
    expect(() => validatePhotos([""])).toThrow(
      "Photo URLs must start with http:// or https://",
    );
  });

  it("allows exactly 20 photos", () => {
    const photos = Array.from({ length: 20 }, (_, i) => `https://example.com/${i}.jpg`);
    expect(() => validatePhotos(photos)).not.toThrow();
  });
});
