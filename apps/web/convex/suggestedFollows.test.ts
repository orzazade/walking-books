import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(clerkId: string, name: string) {
  return {
    clerkId,
    phone: `+1${clerkId.replace(/\D/g, "").padEnd(10, "0")}`,
    name,
    roles: ["reader" as const],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [] as string[],
  };
}

function makeBook(title: string) {
  return {
    title,
    author: "Test Author",
    coverImage: "",
    description: "",
    categories: ["fiction"],
    pageCount: 200,
    language: "English",
    avgRating: 4.0,
    reviewCount: 0,
  };
}

function makeLocation(managedByUserId: string) {
  return {
    name: "Test Library",
    address: "123 Main St",
    lat: 40.71,
    lng: -74.0,
    contactPhone: "+1111111111",
    operatingHours: {},
    photos: [] as string[],
    shelfCapacity: 50,
    currentBookCount: 10,
    managedByUserId,
    staffUserIds: [] as string[],
    avgRating: 0,
    reviewCount: 0,
  };
}

describe("suggestedFollows", () => {
  it("returns empty array for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.suggestedFollows.forMe, {});
    expect(result).toEqual([]);
  });

  it("returns empty array when user has no reading history", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser("user_sf1", "No History"));
    });
    const result = await t
      .withIdentity({ subject: "user_sf1" })
      .query(api.suggestedFollows.forMe, {});
    expect(result).toEqual([]);
  });

  it("suggests readers who have read the same books", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const me = await ctx.db.insert("users", makeUser("user_me", "Me"));
      const reader1 = await ctx.db.insert(
        "users",
        makeUser("user_r1", "Similar Reader"),
      );
      const loc = await ctx.db.insert(
        "partnerLocations",
        makeLocation(me as unknown as string),
      );

      const book1 = await ctx.db.insert("books", makeBook("Shared Book 1"));
      const book2 = await ctx.db.insert("books", makeBook("Shared Book 2"));

      const copy1 = await ctx.db.insert("copies", {
        bookId: book1,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: me,
        qrCodeUrl: "",
        currentLocationId: loc,
      });
      const copy2 = await ctx.db.insert("copies", {
        bookId: book2,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: me,
        qrCodeUrl: "",
        currentLocationId: loc,
      });

      // Me read both books
      await ctx.db.insert("journeyEntries", {
        copyId: copy1,
        readerId: me,
        pickupLocationId: loc,
        pickedUpAt: 1000,
        returnedAt: 2000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: copy2,
        readerId: me,
        pickupLocationId: loc,
        pickedUpAt: 3000,
        returnedAt: 4000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Reader1 also read both books
      await ctx.db.insert("journeyEntries", {
        copyId: copy1,
        readerId: reader1,
        pickupLocationId: loc,
        pickedUpAt: 5000,
        returnedAt: 6000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: copy2,
        readerId: reader1,
        pickupLocationId: loc,
        pickedUpAt: 7000,
        returnedAt: 8000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const result = await t
      .withIdentity({ subject: "user_me" })
      .query(api.suggestedFollows.forMe, {});

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Similar Reader");
    expect(result[0].sharedBooks).toBe(2);
  });

  it("excludes already-followed users", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const me = await ctx.db.insert("users", makeUser("user_me2", "Me"));
      const followed = await ctx.db.insert(
        "users",
        makeUser("user_followed", "Already Followed"),
      );
      const loc = await ctx.db.insert(
        "partnerLocations",
        makeLocation(me as unknown as string),
      );

      const book = await ctx.db.insert("books", makeBook("Test Book"));
      const copy = await ctx.db.insert("copies", {
        bookId: book,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: me,
        qrCodeUrl: "",
        currentLocationId: loc,
      });

      // Both read the book
      await ctx.db.insert("journeyEntries", {
        copyId: copy,
        readerId: me,
        pickupLocationId: loc,
        pickedUpAt: 1000,
        returnedAt: 2000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: copy,
        readerId: followed,
        pickupLocationId: loc,
        pickedUpAt: 3000,
        returnedAt: 4000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Already following
      await ctx.db.insert("follows", {
        followerId: me,
        followingId: followed,
      });
    });

    const result = await t
      .withIdentity({ subject: "user_me2" })
      .query(api.suggestedFollows.forMe, {});

    expect(result).toHaveLength(0);
  });

  it("excludes readers who haven't finished the book", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const me = await ctx.db.insert("users", makeUser("user_me3", "Me"));
      const reader = await ctx.db.insert(
        "users",
        makeUser("user_unfinished", "Unfinished Reader"),
      );
      const loc = await ctx.db.insert(
        "partnerLocations",
        makeLocation(me as unknown as string),
      );

      const book = await ctx.db.insert("books", makeBook("Test Book"));
      const copy = await ctx.db.insert("copies", {
        bookId: book,
        status: "checked_out",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: me,
        qrCodeUrl: "",
        currentHolderId: reader,
      });

      // Me finished
      await ctx.db.insert("journeyEntries", {
        copyId: copy,
        readerId: me,
        pickupLocationId: loc,
        pickedUpAt: 1000,
        returnedAt: 2000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Reader still reading (no returnedAt)
      await ctx.db.insert("journeyEntries", {
        copyId: copy,
        readerId: reader,
        pickupLocationId: loc,
        pickedUpAt: 3000,
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const result = await t
      .withIdentity({ subject: "user_me3" })
      .query(api.suggestedFollows.forMe, {});

    expect(result).toHaveLength(0);
  });

  it("ranks readers by overlap count descending", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const me = await ctx.db.insert("users", makeUser("user_me4", "Me"));
      const reader1 = await ctx.db.insert(
        "users",
        makeUser("user_2books", "Two Books Reader"),
      );
      const reader2 = await ctx.db.insert(
        "users",
        makeUser("user_1book", "One Book Reader"),
      );
      const loc = await ctx.db.insert(
        "partnerLocations",
        makeLocation(me as unknown as string),
      );

      const bookA = await ctx.db.insert("books", makeBook("Book A"));
      const bookB = await ctx.db.insert("books", makeBook("Book B"));

      const copyA = await ctx.db.insert("copies", {
        bookId: bookA,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: me,
        qrCodeUrl: "",
        currentLocationId: loc,
      });
      const copyB = await ctx.db.insert("copies", {
        bookId: bookB,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: me,
        qrCodeUrl: "",
        currentLocationId: loc,
      });

      // Me read both books
      await ctx.db.insert("journeyEntries", {
        copyId: copyA,
        readerId: me,
        pickupLocationId: loc,
        pickedUpAt: 1000,
        returnedAt: 2000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: copyB,
        readerId: me,
        pickupLocationId: loc,
        pickedUpAt: 3000,
        returnedAt: 4000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Reader1 read both books (2 overlap)
      await ctx.db.insert("journeyEntries", {
        copyId: copyA,
        readerId: reader1,
        pickupLocationId: loc,
        pickedUpAt: 5000,
        returnedAt: 6000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: copyB,
        readerId: reader1,
        pickupLocationId: loc,
        pickedUpAt: 7000,
        returnedAt: 8000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });

      // Reader2 read only book A (1 overlap)
      await ctx.db.insert("journeyEntries", {
        copyId: copyA,
        readerId: reader2,
        pickupLocationId: loc,
        pickedUpAt: 9000,
        returnedAt: 10000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const result = await t
      .withIdentity({ subject: "user_me4" })
      .query(api.suggestedFollows.forMe, {});

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Two Books Reader");
    expect(result[0].sharedBooks).toBe(2);
    expect(result[1].name).toBe("One Book Reader");
    expect(result[1].sharedBooks).toBe(1);
  });

  it("excludes inactive users from suggestions", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const me = await ctx.db.insert("users", makeUser("user_me5", "Me"));
      const banned = await ctx.db.insert("users", {
        ...makeUser("user_banned", "Banned Reader"),
        status: "banned" as const,
      });
      const loc = await ctx.db.insert(
        "partnerLocations",
        makeLocation(me as unknown as string),
      );

      const book = await ctx.db.insert("books", makeBook("Test Book"));
      const copy = await ctx.db.insert("copies", {
        bookId: book,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: me,
        qrCodeUrl: "",
        currentLocationId: loc,
      });

      await ctx.db.insert("journeyEntries", {
        copyId: copy,
        readerId: me,
        pickupLocationId: loc,
        pickedUpAt: 1000,
        returnedAt: 2000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: copy,
        readerId: banned,
        pickupLocationId: loc,
        pickedUpAt: 3000,
        returnedAt: 4000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const result = await t
      .withIdentity({ subject: "user_me5" })
      .query(api.suggestedFollows.forMe, {});

    expect(result).toHaveLength(0);
  });

  it("includes correct profile fields in results", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const me = await ctx.db.insert("users", makeUser("user_me6", "Me"));
      const reader = await ctx.db.insert("users", {
        ...makeUser("user_profile", "Profile Reader"),
        avatarUrl: "https://example.com/avatar.jpg",
        booksRead: 15,
      });
      const loc = await ctx.db.insert(
        "partnerLocations",
        makeLocation(me as unknown as string),
      );

      const book = await ctx.db.insert("books", makeBook("Shared Book"));
      const copy = await ctx.db.insert("copies", {
        bookId: book,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: me,
        qrCodeUrl: "",
        currentLocationId: loc,
      });

      await ctx.db.insert("journeyEntries", {
        copyId: copy,
        readerId: me,
        pickupLocationId: loc,
        pickedUpAt: 1000,
        returnedAt: 2000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      await ctx.db.insert("journeyEntries", {
        copyId: copy,
        readerId: reader,
        pickupLocationId: loc,
        pickedUpAt: 3000,
        returnedAt: 4000,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    });

    const result = await t
      .withIdentity({ subject: "user_me6" })
      .query(api.suggestedFollows.forMe, {});

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("_id");
    expect(result[0]).toHaveProperty("name", "Profile Reader");
    expect(result[0]).toHaveProperty(
      "avatarUrl",
      "https://example.com/avatar.jpg",
    );
    expect(result[0]).toHaveProperty("booksRead", 15);
    expect(result[0]).toHaveProperty("sharedBooks", 1);
  });
});
