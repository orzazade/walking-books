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
