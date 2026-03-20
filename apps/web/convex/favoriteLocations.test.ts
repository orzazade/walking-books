import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("favoriteLocations", () => {
  it("toggle adds and removes a location from favorites", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "user_fav1",
        phone: "+1234567890",
        name: "Fav User",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
    });

    const locationId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", {
        name: "Cozy Cafe",
        address: "42 Book Lane",
        lat: 40.7,
        lng: -74.0,
        contactPhone: "+1000000000",
        operatingHours: {},
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 10,
        managedByUserId: userId,
        staffUserIds: [],
        avgRating: 4.5,
        reviewCount: 3,
      });
    });

    const authed = t.withIdentity({ subject: "user_fav1" });

    // Initially not favorited
    const before = await authed.query(api.favoriteLocations.isFavorited, { locationId });
    expect(before).toBe(false);

    // Toggle on
    const result = await authed.mutation(api.favoriteLocations.toggle, { locationId });
    expect(result.favorited).toBe(true);

    // Verify favorited
    const after = await authed.query(api.favoriteLocations.isFavorited, { locationId });
    expect(after).toBe(true);

    // Should appear in myFavorites
    const favorites = await authed.query(api.favoriteLocations.myFavorites, {});
    expect(favorites).toHaveLength(1);
    expect(favorites[0].name).toBe("Cozy Cafe");
    expect(favorites[0].address).toBe("42 Book Lane");

    // Toggle off
    const result2 = await authed.mutation(api.favoriteLocations.toggle, { locationId });
    expect(result2.favorited).toBe(false);

    // Verify removed
    const final = await authed.query(api.favoriteLocations.isFavorited, { locationId });
    expect(final).toBe(false);

    // Should be empty
    const empty = await authed.query(api.favoriteLocations.myFavorites, {});
    expect(empty).toHaveLength(0);
  });

  it("myFavorites shows available book count", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "user_fav2",
        phone: "+1234567891",
        name: "Fav User 2",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
    });

    const locationId = await t.run(async (ctx) => {
      const locId = await ctx.db.insert("partnerLocations", {
        name: "Reading Room",
        address: "99 Library St",
        lat: 51.5,
        lng: -0.1,
        contactPhone: "+1000000001",
        operatingHours: {},
        photos: [],
        shelfCapacity: 100,
        currentBookCount: 2,
        managedByUserId: userId,
        staffUserIds: [],
        avgRating: 4.0,
        reviewCount: 1,
      });

      const bookId = await ctx.db.insert("books", {
        title: "Test Book",
        author: "Author",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 200,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });

      // Add 2 available copies and 1 checked-out
      await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "fair",
        ownershipType: "donated",
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });

      return locId;
    });

    const authed = t.withIdentity({ subject: "user_fav2" });

    await authed.mutation(api.favoriteLocations.toggle, { locationId });
    const favorites = await authed.query(api.favoriteLocations.myFavorites, {});

    expect(favorites).toHaveLength(1);
    expect(favorites[0].availableBooks).toBe(2);
  });

  it("newArrivals returns recently added copies at favorite locations", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "user_arrivals",
        phone: "+1234567892",
        name: "Arrivals User",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
    });

    const { locationId, bookId } = await t.run(async (ctx) => {
      const locId = await ctx.db.insert("partnerLocations", {
        name: "Book Haven",
        address: "10 Novel Ave",
        lat: 40.7,
        lng: -74.0,
        contactPhone: "+1000000002",
        operatingHours: {},
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 1,
        managedByUserId: userId,
        staffUserIds: [],
        avgRating: 4.2,
        reviewCount: 5,
      });

      const bId = await ctx.db.insert("books", {
        title: "New Arrival Book",
        author: "Fresh Author",
        coverImage: "cover.jpg",
        description: "A fresh book",
        categories: ["fiction"],
        pageCount: 300,
        language: "English",
        avgRating: 4.5,
        reviewCount: 2,
      });

      // Recent available copy (will appear in new arrivals)
      await ctx.db.insert("copies", {
        bookId: bId,
        status: "available",
        condition: "like_new",
        ownershipType: "lent",
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });

      return { locationId: locId, bookId: bId };
    });

    const authed = t.withIdentity({ subject: "user_arrivals" });

    // Favorite the location first
    await authed.mutation(api.favoriteLocations.toggle, { locationId });

    const arrivals = await authed.query(api.favoriteLocations.newArrivals, {});
    expect(arrivals.length).toBeGreaterThanOrEqual(1);
    expect(arrivals[0].title).toBe("New Arrival Book");
    expect(arrivals[0].author).toBe("Fresh Author");
    expect(arrivals[0].locationName).toBe("Book Haven");
    expect(arrivals[0].bookId).toBe(bookId);
  });

  it("toggle rejects nonexistent location", async () => {
    const t = convexTest(schema, modules);

    const { fakeLocationId } = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: "user_fav_noloc",
        phone: "+1234567899",
        name: "No Loc User",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
      const uid = await ctx.db.insert("users", {
        clerkId: "tmp_mgr",
        phone: "+1000000099",
        name: "Tmp Manager",
        roles: ["partner"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
      const locId = await ctx.db.insert("partnerLocations", {
        name: "Ghost Loc",
        address: "0 Nowhere",
        lat: 0,
        lng: 0,
        contactPhone: "+1000000099",
        operatingHours: {},
        photos: [],
        shelfCapacity: 10,
        currentBookCount: 0,
        managedByUserId: uid,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
      await ctx.db.delete(locId);
      return { fakeLocationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_fav_noloc" });
    await expect(
      authed.mutation(api.favoriteLocations.toggle, { locationId: fakeLocationId }),
    ).rejects.toThrow("Location not found");
  });

  it("toggle rejects when at max favorites limit", async () => {
    const t = convexTest(schema, modules);

    const { locationIds } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "user_fav_limit",
        phone: "+1234567898",
        name: "Limit User",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
      const mgrId = await ctx.db.insert("users", {
        clerkId: "mgr_limit",
        phone: "+1000000098",
        name: "Mgr Limit",
        roles: ["partner"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
      const ids: string[] = [];
      // Create 51 locations, favorite the first 50 directly
      for (let i = 0; i < 51; i++) {
        const locId = await ctx.db.insert("partnerLocations", {
          name: `Loc ${i}`,
          address: `${i} St`,
          lat: 0,
          lng: 0,
          contactPhone: "+1000000000",
          operatingHours: {},
          photos: [],
          shelfCapacity: 10,
          currentBookCount: 0,
          managedByUserId: mgrId,
          staffUserIds: [],
          avgRating: 0,
          reviewCount: 0,
        });
        ids.push(locId as string);
        if (i < 50) {
          await ctx.db.insert("favoriteLocations", {
            userId,
            locationId: locId,
            favoritedAt: Date.now(),
          });
        }
      }
      return { locationIds: ids };
    });

    const authed = t.withIdentity({ subject: "user_fav_limit" });
    await expect(
      authed.mutation(api.favoriteLocations.toggle, {
        locationId: locationIds[50] as any,
      }),
    ).rejects.toThrow("Maximum 50 favorite locations allowed");
  });

  it("isFavorited returns false for unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    const locationId = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", {
        clerkId: "manager1",
        phone: "+1000000000",
        name: "Manager",
        roles: ["partner"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
      return await ctx.db.insert("partnerLocations", {
        name: "Test Spot",
        address: "1 Main St",
        lat: 0,
        lng: 0,
        contactPhone: "+1000000000",
        operatingHours: {},
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 0,
        managedByUserId: uid,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
    });

    const result = await t.query(api.favoriteLocations.isFavorited, { locationId });
    expect(result).toBe(false);
  });
});
