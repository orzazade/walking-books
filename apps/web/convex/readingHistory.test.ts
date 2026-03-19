import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("readingHistory", () => {
  it("returns completed reads sorted by most recent", async () => {
    const t = convexTest(schema, modules);

    const { userId, locationId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", {
        clerkId: "user_history1",
        phone: "+1234567890",
        name: "Reader",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 2,
        favoriteGenres: [],
      });
      const lid = await ctx.db.insert("partnerLocations", {
        name: "Downtown Library",
        address: "123 Main St",
        lat: 40.7128,
        lng: -74.006,
        contactPhone: "+1111111111",
        operatingHours: {},
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 10,
        managedByUserId: uid,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
      return { userId: uid, locationId: lid };
    });

    // Create two books with copies and completed journey entries
    const { bookId1, bookId2 } = await t.run(async (ctx) => {
      const bid1 = await ctx.db.insert("books", {
        title: "First Book",
        author: "Author A",
        coverImage: "https://example.com/a.jpg",
        description: "First test book",
        categories: ["fiction"],
        pageCount: 200,
        language: "English",
        avgRating: 4.0,
        reviewCount: 5,
      });
      const cid1 = await ctx.db.insert("copies", {
        bookId: bid1,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "https://example.com/qr1",
        currentLocationId: locationId,
      });
      await ctx.db.insert("journeyEntries", {
        copyId: cid1,
        readerId: userId,
        pickupLocationId: locationId,
        dropoffLocationId: locationId,
        pickedUpAt: 1000000,
        returnedAt: 1500000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
        readerNote: "Great read!",
      });

      const bid2 = await ctx.db.insert("books", {
        title: "Second Book",
        author: "Author B",
        coverImage: "https://example.com/b.jpg",
        description: "Second test book",
        categories: ["non-fiction"],
        pageCount: 300,
        language: "English",
        avgRating: 3.5,
        reviewCount: 2,
      });
      const cid2 = await ctx.db.insert("copies", {
        bookId: bid2,
        status: "available",
        condition: "like_new",
        ownershipType: "lent",
        originalSharerId: userId,
        qrCodeUrl: "https://example.com/qr2",
        currentLocationId: locationId,
      });
      await ctx.db.insert("journeyEntries", {
        copyId: cid2,
        readerId: userId,
        pickupLocationId: locationId,
        dropoffLocationId: locationId,
        pickedUpAt: 2000000,
        returnedAt: 3000000,
        conditionAtPickup: "like_new",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      return { bookId1: bid1, bookId2: bid2 };
    });

    const history = await t.withIdentity({ subject: "user_history1" }).query(api.readingHistory.myHistory, {});

    expect(history).toHaveLength(2);
    // Most recently returned first
    expect(history[0].title).toBe("Second Book");
    expect(history[0].author).toBe("Author B");
    expect(history[0].returnedAt).toBe(3000000);
    expect(history[0].pickupLocation).toBe("Downtown Library");
    expect(history[0].conditionAtReturn).toBe("good");
    expect(history[0].categories).toEqual(["non-fiction"]);

    expect(history[1].title).toBe("First Book");
    expect(history[1].readerNote).toBe("Great read!");
    expect(history[1].daysHeld).toBeGreaterThan(0);
  });

  it("excludes in-progress reads (not yet returned)", async () => {
    const t = convexTest(schema, modules);

    const { userId, locationId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", {
        clerkId: "user_history2",
        phone: "+1234567892",
        name: "Active Reader",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
      const lid = await ctx.db.insert("partnerLocations", {
        name: "Cafe Books",
        address: "456 Oak Ave",
        lat: 40.73,
        lng: -73.99,
        contactPhone: "+2222222222",
        operatingHours: {},
        photos: [],
        shelfCapacity: 20,
        currentBookCount: 5,
        managedByUserId: uid,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
      return { userId: uid, locationId: lid };
    });

    await t.run(async (ctx) => {
      const bid = await ctx.db.insert("books", {
        title: "Currently Reading",
        author: "Author C",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 100,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });
      const cid = await ctx.db.insert("copies", {
        bookId: bid,
        status: "checked_out",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        currentHolderId: userId,
        qrCodeUrl: "https://example.com/qr3",
      });
      // Journey entry with no returnedAt = still reading
      await ctx.db.insert("journeyEntries", {
        copyId: cid,
        readerId: userId,
        pickupLocationId: locationId,
        pickedUpAt: Date.now(),
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const history = await t.withIdentity({ subject: "user_history2" }).query(api.readingHistory.myHistory, {});

    expect(history).toHaveLength(0);
  });

  it("returns empty array for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const history = await t.query(api.readingHistory.myHistory, {});
    expect(history).toEqual([]);
  });
});
