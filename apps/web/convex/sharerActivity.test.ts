import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "sharer1",
    phone: "+1234567890",
    name: "Sharer One",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 1,
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
    avgRating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

describe("sharerActivity", () => {
  it("returns empty feed for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.sharerActivity.feed, {});
    expect(result).toEqual([]);
  });

  it("returns empty feed when user has no shared copies", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "sharer1" });
    const result = await authed.query(api.sharerActivity.feed, {});
    expect(result).toEqual([]);
  });

  it("returns pickup events for sharer's copies", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser());
      const readerId = await ctx.db.insert("users", makeUser({ clerkId: "reader1", phone: "+2222222222", name: "Reader One" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locationId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string, { name: "Downtown Library" }));
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "checked_out" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: sharerId,
        currentLocationId: locationId,
        currentHolderId: readerId,
        qrCodeUrl: "https://example.com/qr/1",
      });
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId,
        pickupLocationId: locationId,
        pickedUpAt: Date.now(),
        conditionAtPickup: "good" as const,
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const authed = t.withIdentity({ subject: "sharer1" });
    const result = await authed.query(api.sharerActivity.feed, {});
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("pickup");
    expect(result[0].book.title).toBe("Test Book");
    expect(result[0].reader?.name).toBe("Reader One");
    expect(result[0].detail.locationName).toBe("Downtown Library");
  });

  it("returns both pickup and return events", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser());
      const readerId = await ctx.db.insert("users", makeUser({ clerkId: "reader1", phone: "+2222222222", name: "Reader One" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locationId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: sharerId,
        currentLocationId: locationId,
        qrCodeUrl: "https://example.com/qr/1",
      });
      const now = Date.now();
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId,
        pickupLocationId: locationId,
        dropoffLocationId: locationId,
        pickedUpAt: now - 86400000,
        returnedAt: now,
        conditionAtPickup: "good" as const,
        conditionAtReturn: "good" as const,
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const authed = t.withIdentity({ subject: "sharer1" });
    const result = await authed.query(api.sharerActivity.feed, {});
    expect(result).toHaveLength(2);
    // Return is more recent, should come first
    expect(result[0].type).toBe("return");
    expect(result[1].type).toBe("pickup");
  });

  it("returns condition report events", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser());
      const reporterId = await ctx.db.insert("users", makeUser({ clerkId: "reporter1", phone: "+3333333333", name: "Reporter" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locationId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "fair" as const,
        ownershipType: "donated" as const,
        originalSharerId: sharerId,
        currentLocationId: locationId,
        qrCodeUrl: "https://example.com/qr/1",
      });
      await ctx.db.insert("conditionReports", {
        copyId,
        reportedByUserId: reporterId,
        type: "damage_report" as const,
        photos: [],
        description: "Water damage on cover",
        previousCondition: "good" as const,
        newCondition: "fair" as const,
        createdAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: "sharer1" });
    const result = await authed.query(api.sharerActivity.feed, {});
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("condition_report");
    expect(result[0].detail.previousCondition).toBe("good");
    expect(result[0].detail.newCondition).toBe("fair");
    expect(result[0].detail.reportType).toBe("damage_report");
    expect(result[0].reader?.name).toBe("Reporter");
  });

  it("returns review events for books the sharer shared", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser());
      const reviewerId = await ctx.db.insert("users", makeUser({ clerkId: "reviewer1", phone: "+4444444444", name: "Reviewer" }));
      const bookId = await ctx.db.insert("books", makeBook({ title: "Shared Book" }));
      const locationId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: sharerId,
        currentLocationId: locationId,
        qrCodeUrl: "https://example.com/qr/1",
      });
      await ctx.db.insert("reviews", {
        bookId,
        userId: reviewerId,
        rating: 5,
        text: "Amazing book!",
      });
    });

    const authed = t.withIdentity({ subject: "sharer1" });
    const result = await authed.query(api.sharerActivity.feed, {});
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("review");
    expect(result[0].detail.rating).toBe(5);
    expect(result[0].detail.reviewText).toBe("Amazing book!");
    expect(result[0].reader?.name).toBe("Reviewer");
    expect(result[0].book.title).toBe("Shared Book");
  });

  it("excludes sharer's own reviews from feed", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locationId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: sharerId,
        currentLocationId: locationId,
        qrCodeUrl: "https://example.com/qr/1",
      });
      // Sharer's own review should be excluded
      await ctx.db.insert("reviews", {
        bookId,
        userId: sharerId,
        rating: 4,
        text: "I liked sharing this",
      });
    });

    const authed = t.withIdentity({ subject: "sharer1" });
    const result = await authed.query(api.sharerActivity.feed, {});
    expect(result).toHaveLength(0);
  });

  it("respects limit parameter", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser());
      const readerId = await ctx.db.insert("users", makeUser({ clerkId: "reader1", phone: "+2222222222", name: "Reader" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locationId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: sharerId,
        currentLocationId: locationId,
        qrCodeUrl: "https://example.com/qr/1",
      });
      const now = Date.now();
      // Create 3 journey entries (6 events: 3 pickups + 3 returns)
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("journeyEntries", {
          copyId,
          readerId,
          pickupLocationId: locationId,
          dropoffLocationId: locationId,
          pickedUpAt: now - (i + 1) * 86400000 * 2,
          returnedAt: now - (i + 1) * 86400000,
          conditionAtPickup: "good" as const,
          conditionAtReturn: "good" as const,
          pickupPhotos: [],
          returnPhotos: [],
        });
      }
    });

    const authed = t.withIdentity({ subject: "sharer1" });
    const result = await authed.query(api.sharerActivity.feed, { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it("sorts events by most recent first across event types", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser());
      const readerId = await ctx.db.insert("users", makeUser({ clerkId: "reader1", phone: "+2222222222", name: "Reader" }));
      const reviewerId = await ctx.db.insert("users", makeUser({ clerkId: "reviewer1", phone: "+3333333333", name: "Reviewer" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locationId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: sharerId,
        currentLocationId: locationId,
        qrCodeUrl: "https://example.com/qr/1",
      });
      const now = Date.now();
      // Pickup happened 2 days ago
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId,
        pickupLocationId: locationId,
        pickedUpAt: now - 172800000,
        conditionAtPickup: "good" as const,
        pickupPhotos: [],
        returnPhotos: [],
      });
      // Condition report filed 1 day ago
      await ctx.db.insert("conditionReports", {
        copyId,
        reportedByUserId: readerId,
        type: "return_check" as const,
        photos: [],
        description: "Routine check",
        previousCondition: "good" as const,
        newCondition: "good" as const,
        createdAt: now - 86400000,
      });
      // Review posted today (most recent)
      await ctx.db.insert("reviews", {
        bookId,
        userId: reviewerId,
        rating: 4,
        text: "Nice read",
      });
    });

    const authed = t.withIdentity({ subject: "sharer1" });
    const result = await authed.query(api.sharerActivity.feed, {});
    expect(result).toHaveLength(3);
    // Review is most recent (_creationTime), then condition report, then pickup
    expect(result[0].type).toBe("review");
    expect(result[1].type).toBe("condition_report");
    expect(result[2].type).toBe("pickup");
  });
});
