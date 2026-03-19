import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user1",
    phone: "+1234567890",
    name: "User One",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

function makeBook(overrides: Record<string, unknown> = {}) {
  return {
    title: "Test Book",
    author: "Test Author",
    coverImage: "",
    description: "",
    categories: ["fiction"],
    pageCount: 200,
    language: "English",
    avgRating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

function makeLocation(managedByUserId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Location",
    address: "123 Main St",
    lat: 40.0,
    lng: -74.0,
    contactPhone: "+0000000000",
    operatingHours: {},
    photos: [],
    shelfCapacity: 50,
    currentBookCount: 5,
    managedByUserId,
    staffUserIds: [],
    ...overrides,
  };
}

describe("bookJourney", () => {
  describe("forCopy", () => {
    it("returns empty array for a copy with no journey entries", async () => {
      const t = convexTest(schema, modules);

      let copyId: unknown;
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", makeUser());
        const bookId = await ctx.db.insert("books", makeBook());
        const locationId = await ctx.db.insert("partnerLocations", makeLocation(userId as unknown as string));
        copyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "donated" as const,
          originalSharerId: userId,
          currentLocationId: locationId,
          qrCodeUrl: "https://example.com/qr/1",
        });
      });

      const result = await t.query(api.bookJourney.forCopy, { copyId: copyId as any });
      expect(result).toEqual([]);
    });

    it("returns chronological journey with reader names and locations", async () => {
      const t = convexTest(schema, modules);

      let copyId: unknown;
      await t.run(async (ctx) => {
        const sharerId = await ctx.db.insert("users", makeUser());
        const reader1 = await ctx.db.insert("users", makeUser({ clerkId: "r1", phone: "+1111111111", name: "Alice" }));
        const reader2 = await ctx.db.insert("users", makeUser({ clerkId: "r2", phone: "+2222222222", name: "Bob" }));
        const bookId = await ctx.db.insert("books", makeBook());
        const loc1 = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string, { name: "Downtown Cafe" }));
        const loc2 = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string, { name: "Park Library" }));
        copyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "donated" as const,
          originalSharerId: sharerId,
          currentLocationId: loc2,
          qrCodeUrl: "https://example.com/qr/1",
        });

        const now = Date.now();
        // Alice picked up from Downtown, returned to Park Library
        await ctx.db.insert("journeyEntries", {
          copyId: copyId as any,
          readerId: reader1,
          pickupLocationId: loc1,
          dropoffLocationId: loc2,
          pickedUpAt: now - 10 * 86400000,
          returnedAt: now - 5 * 86400000,
          conditionAtPickup: "good" as const,
          conditionAtReturn: "good" as const,
          pickupPhotos: [],
          returnPhotos: [],
          readerNote: "Great read!",
        });
        // Bob picked up from Park Library (still reading)
        await ctx.db.insert("journeyEntries", {
          copyId: copyId as any,
          readerId: reader2,
          pickupLocationId: loc2,
          pickedUpAt: now - 2 * 86400000,
          conditionAtPickup: "good" as const,
          pickupPhotos: [],
          returnPhotos: [],
        });
      });

      const result = await t.query(api.bookJourney.forCopy, { copyId: copyId as any });
      expect(result).toHaveLength(2);

      // First stop: Alice (chronologically first)
      expect(result[0].readerName).toBe("Alice");
      expect(result[0].pickupLocation.name).toBe("Downtown Cafe");
      expect(result[0].returnLocation?.name).toBe("Park Library");
      expect(result[0].daysHeld).toBe(5);
      expect(result[0].conditionAtPickup).toBe("good");
      expect(result[0].conditionAtReturn).toBe("good");
      expect(result[0].readerNote).toBe("Great read!");

      // Second stop: Bob (still reading)
      expect(result[1].readerName).toBe("Bob");
      expect(result[1].pickupLocation.name).toBe("Park Library");
      expect(result[1].returnLocation).toBeNull();
      expect(result[1].daysHeld).toBeNull();
      expect(result[1].returnedAt).toBeNull();
    });

    it("shows condition changes across stops", async () => {
      const t = convexTest(schema, modules);

      let copyId: unknown;
      await t.run(async (ctx) => {
        const sharerId = await ctx.db.insert("users", makeUser());
        const reader1 = await ctx.db.insert("users", makeUser({ clerkId: "r1", phone: "+1111111111", name: "Alice" }));
        const reader2 = await ctx.db.insert("users", makeUser({ clerkId: "r2", phone: "+2222222222", name: "Bob" }));
        const bookId = await ctx.db.insert("books", makeBook());
        const loc = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
        copyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "fair" as const,
          ownershipType: "donated" as const,
          originalSharerId: sharerId,
          currentLocationId: loc,
          qrCodeUrl: "https://example.com/qr/1",
        });

        const now = Date.now();
        await ctx.db.insert("journeyEntries", {
          copyId: copyId as any,
          readerId: reader1,
          pickupLocationId: loc,
          dropoffLocationId: loc,
          pickedUpAt: now - 20 * 86400000,
          returnedAt: now - 15 * 86400000,
          conditionAtPickup: "good" as const,
          conditionAtReturn: "good" as const,
          pickupPhotos: [],
          returnPhotos: [],
        });
        await ctx.db.insert("journeyEntries", {
          copyId: copyId as any,
          readerId: reader2,
          pickupLocationId: loc,
          dropoffLocationId: loc,
          pickedUpAt: now - 10 * 86400000,
          returnedAt: now - 5 * 86400000,
          conditionAtPickup: "good" as const,
          conditionAtReturn: "fair" as const,
          pickupPhotos: [],
          returnPhotos: [],
        });
      });

      const result = await t.query(api.bookJourney.forCopy, { copyId: copyId as any });
      expect(result).toHaveLength(2);
      expect(result[0].conditionAtReturn).toBe("good");
      expect(result[1].conditionAtPickup).toBe("good");
      expect(result[1].conditionAtReturn).toBe("fair");
    });

    it("handles deleted readers gracefully", async () => {
      const t = convexTest(schema, modules);

      let copyId: unknown;
      await t.run(async (ctx) => {
        const sharerId = await ctx.db.insert("users", makeUser());
        const readerId = await ctx.db.insert("users", makeUser({ clerkId: "r1", phone: "+1111111111", name: "Ghost" }));
        const bookId = await ctx.db.insert("books", makeBook());
        const loc = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
        copyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "donated" as const,
          originalSharerId: sharerId,
          currentLocationId: loc,
          qrCodeUrl: "https://example.com/qr/1",
        });
        await ctx.db.insert("journeyEntries", {
          copyId: copyId as any,
          readerId,
          pickupLocationId: loc,
          dropoffLocationId: loc,
          pickedUpAt: Date.now() - 86400000,
          returnedAt: Date.now(),
          conditionAtPickup: "good" as const,
          conditionAtReturn: "good" as const,
          pickupPhotos: [],
          returnPhotos: [],
        });
        // Delete the reader
        await ctx.db.delete(readerId);
      });

      const result = await t.query(api.bookJourney.forCopy, { copyId: copyId as any });
      expect(result).toHaveLength(1);
      expect(result[0].readerName).toBe("Unknown reader");
    });
  });

  describe("summary", () => {
    it("returns aggregate stats for a copy journey", async () => {
      const t = convexTest(schema, modules);

      let copyId: unknown;
      await t.run(async (ctx) => {
        const sharerId = await ctx.db.insert("users", makeUser());
        const reader1 = await ctx.db.insert("users", makeUser({ clerkId: "r1", phone: "+1111111111" }));
        const reader2 = await ctx.db.insert("users", makeUser({ clerkId: "r2", phone: "+2222222222" }));
        const bookId = await ctx.db.insert("books", makeBook({ title: "Journey Book", author: "Jane Doe" }));
        const loc1 = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string, { name: "Cafe A" }));
        const loc2 = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string, { name: "Library B" }));
        copyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "donated" as const,
          originalSharerId: sharerId,
          currentLocationId: loc2,
          qrCodeUrl: "https://example.com/qr/1",
        });

        const now = Date.now();
        await ctx.db.insert("journeyEntries", {
          copyId: copyId as any,
          readerId: reader1,
          pickupLocationId: loc1,
          dropoffLocationId: loc2,
          pickedUpAt: now - 20 * 86400000,
          returnedAt: now - 13 * 86400000,
          conditionAtPickup: "good" as const,
          conditionAtReturn: "good" as const,
          pickupPhotos: [],
          returnPhotos: [],
        });
        await ctx.db.insert("journeyEntries", {
          copyId: copyId as any,
          readerId: reader2,
          pickupLocationId: loc2,
          dropoffLocationId: loc1,
          pickedUpAt: now - 10 * 86400000,
          returnedAt: now - 7 * 86400000,
          conditionAtPickup: "good" as const,
          conditionAtReturn: "good" as const,
          pickupPhotos: [],
          returnPhotos: [],
        });
      });

      const result = await t.query(api.bookJourney.summary, { copyId: copyId as any });
      expect(result.bookTitle).toBe("Journey Book");
      expect(result.bookAuthor).toBe("Jane Doe");
      expect(result.totalReaders).toBe(2);
      expect(result.uniqueLocations).toBe(2);
      expect(result.totalLendings).toBe(2);
      expect(result.completedLendings).toBe(2);
      expect(result.totalDaysLent).toBe(10); // 7 + 3
      expect(result.avgDaysPerLending).toBe(5);
      expect(result.copyStatus).toBe("available");
    });

    it("returns null avgDaysPerLending when no completed lendings", async () => {
      const t = convexTest(schema, modules);

      let copyId: unknown;
      await t.run(async (ctx) => {
        const sharerId = await ctx.db.insert("users", makeUser());
        const readerId = await ctx.db.insert("users", makeUser({ clerkId: "r1", phone: "+1111111111" }));
        const bookId = await ctx.db.insert("books", makeBook());
        const loc = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
        copyId = await ctx.db.insert("copies", {
          bookId,
          status: "checked_out" as const,
          condition: "good" as const,
          ownershipType: "donated" as const,
          originalSharerId: sharerId,
          currentLocationId: loc,
          currentHolderId: readerId,
          qrCodeUrl: "https://example.com/qr/1",
        });
        await ctx.db.insert("journeyEntries", {
          copyId: copyId as any,
          readerId,
          pickupLocationId: loc,
          pickedUpAt: Date.now() - 86400000,
          conditionAtPickup: "good" as const,
          pickupPhotos: [],
          returnPhotos: [],
        });
      });

      const result = await t.query(api.bookJourney.summary, { copyId: copyId as any });
      expect(result.totalLendings).toBe(1);
      expect(result.completedLendings).toBe(0);
      expect(result.avgDaysPerLending).toBeNull();
      expect(result.currentHolder).not.toBeNull();
      expect(result.copyStatus).toBe("checked_out");
    });

    it("throws for non-existent copy", async () => {
      const t = convexTest(schema, modules);

      let fakeCopyId: unknown;
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", makeUser());
        const bookId = await ctx.db.insert("books", makeBook());
        const loc = await ctx.db.insert("partnerLocations", makeLocation(userId as unknown as string));
        const realCopyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "donated" as const,
          originalSharerId: userId,
          currentLocationId: loc,
          qrCodeUrl: "https://example.com/qr/1",
        });
        fakeCopyId = realCopyId;
        await ctx.db.delete(realCopyId);
      });

      await expect(
        t.query(api.bookJourney.summary, { copyId: fakeCopyId as any }),
      ).rejects.toThrow("Copy not found");
    });

    it("returns zero stats for a copy with no journey entries", async () => {
      const t = convexTest(schema, modules);

      let copyId: unknown;
      await t.run(async (ctx) => {
        const sharerId = await ctx.db.insert("users", makeUser());
        const bookId = await ctx.db.insert("books", makeBook({ title: "Fresh Book" }));
        const loc = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string, { name: "Home Base" }));
        copyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "donated" as const,
          originalSharerId: sharerId,
          currentLocationId: loc,
          qrCodeUrl: "https://example.com/qr/1",
        });
      });

      const result = await t.query(api.bookJourney.summary, { copyId: copyId as any });
      expect(result.bookTitle).toBe("Fresh Book");
      expect(result.totalReaders).toBe(0);
      expect(result.uniqueLocations).toBe(0);
      expect(result.totalLendings).toBe(0);
      expect(result.completedLendings).toBe(0);
      expect(result.totalDaysLent).toBe(0);
      expect(result.avgDaysPerLending).toBeNull();
      expect(result.currentLocation?.name).toBe("Home Base");
    });
  });
});
