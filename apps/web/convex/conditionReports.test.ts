import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("conditionReports", () => {
  it("byCopy returns condition reports for a specific copy sorted by newest first", async () => {
    const t = convexTest(schema, modules);

    const { copyId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "user_cr1",
        phone: "+1234567890",
        name: "Test User",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });

      const bookId = await ctx.db.insert("books", {
        title: "Test Book",
        author: "Test Author",
        coverImage: "https://example.com/cover.jpg",
        description: "A test book",
        categories: ["fiction"],
        pageCount: 200,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });

      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "https://example.com/qr",
      });

      // Insert reports with different timestamps
      await ctx.db.insert("conditionReports", {
        copyId,
        reportedByUserId: userId,
        type: "pickup_check",
        photos: [],
        description: "Looks great at pickup",
        previousCondition: "like_new",
        newCondition: "like_new",
        createdAt: 1000,
      });

      await ctx.db.insert("conditionReports", {
        copyId,
        reportedByUserId: userId,
        type: "return_check",
        photos: ["https://example.com/photo1.jpg"],
        description: "Minor wear on spine",
        previousCondition: "like_new",
        newCondition: "good",
        createdAt: 2000,
      });

      await ctx.db.insert("conditionReports", {
        copyId,
        reportedByUserId: userId,
        type: "damage_report",
        photos: [],
        description: "Coffee stain on page 42",
        previousCondition: "good",
        newCondition: "fair",
        createdAt: 3000,
      });

      return { copyId };
    });

    const reports = await t.query(api.conditionReports.byCopy, { copyId });

    expect(reports).toHaveLength(3);
    // Newest first
    expect(reports[0].type).toBe("damage_report");
    expect(reports[0].createdAt).toBe(3000);
    expect(reports[1].type).toBe("return_check");
    expect(reports[1].createdAt).toBe(2000);
    expect(reports[2].type).toBe("pickup_check");
    expect(reports[2].createdAt).toBe(1000);
  });

  it("byCopy returns empty array when copy has no reports", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "user_cr2",
        phone: "+1234567891",
        name: "Test User 2",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });

      const bookId = await ctx.db.insert("books", {
        title: "Clean Book",
        author: "Author",
        coverImage: "",
        description: "No reports",
        categories: [],
        pageCount: 100,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });

      return await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "like_new",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
      });
    });

    const reports = await t.query(api.conditionReports.byCopy, { copyId });
    expect(reports).toEqual([]);
  });

  it("byCopy only returns reports for the requested copy", async () => {
    const t = convexTest(schema, modules);

    const { copyId1, copyId2 } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "user_cr3",
        phone: "+1234567892",
        name: "Test User 3",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });

      const bookId = await ctx.db.insert("books", {
        title: "Multi Copy Book",
        author: "Author",
        coverImage: "",
        description: "Two copies",
        categories: [],
        pageCount: 100,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });

      const c1 = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
      });

      const c2 = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "fair",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
      });

      // Report on copy 1
      await ctx.db.insert("conditionReports", {
        copyId: c1,
        reportedByUserId: userId,
        type: "pickup_check",
        photos: [],
        description: "Copy 1 report",
        previousCondition: "good",
        newCondition: "good",
        createdAt: 1000,
      });

      // Report on copy 2
      await ctx.db.insert("conditionReports", {
        copyId: c2,
        reportedByUserId: userId,
        type: "return_check",
        photos: [],
        description: "Copy 2 report",
        previousCondition: "fair",
        newCondition: "fair",
        createdAt: 2000,
      });

      return { copyId1: c1, copyId2: c2 };
    });

    const reports1 = await t.query(api.conditionReports.byCopy, { copyId: copyId1 });
    expect(reports1).toHaveLength(1);
    expect(reports1[0].description).toBe("Copy 1 report");

    const reports2 = await t.query(api.conditionReports.byCopy, { copyId: copyId2 });
    expect(reports2).toHaveLength(1);
    expect(reports2[0].description).toBe("Copy 2 report");
  });

  it("byCopy includes photo URLs and condition transitions", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "user_cr4",
        phone: "+1234567893",
        name: "Test User 4",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });

      const bookId = await ctx.db.insert("books", {
        title: "Photo Book",
        author: "Author",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 100,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });

      const cId = await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "fair",
        ownershipType: "lent",
        originalSharerId: userId,
        qrCodeUrl: "",
      });

      await ctx.db.insert("conditionReports", {
        copyId: cId,
        reportedByUserId: userId,
        type: "damage_report",
        photos: ["https://example.com/damage1.jpg", "https://example.com/damage2.jpg"],
        description: "Water damage on cover",
        previousCondition: "good",
        newCondition: "fair",
        createdAt: 5000,
      });

      return cId;
    });

    const reports = await t.query(api.conditionReports.byCopy, { copyId });
    expect(reports).toHaveLength(1);
    expect(reports[0].photos).toEqual([
      "https://example.com/damage1.jpg",
      "https://example.com/damage2.jpg",
    ]);
    expect(reports[0].previousCondition).toBe("good");
    expect(reports[0].newCondition).toBe("fair");
    expect(reports[0].description).toBe("Water damage on cover");
  });

  it("rejects condition report from unrelated user", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", {
        clerkId: "user_cr_sharer",
        phone: "+1111111111",
        name: "Sharer",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 1,
        booksRead: 0,
        favoriteGenres: [],
      });
      await ctx.db.insert("users", {
        clerkId: "user_cr_stranger",
        phone: "+2222222222",
        name: "Stranger",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 0,
        booksRead: 0,
        favoriteGenres: [],
      });
      const bookId = await ctx.db.insert("books", {
        title: "Auth Book",
        author: "Author",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 100,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });
      return await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        qrCodeUrl: "",
      });
    });

    const stranger = t.withIdentity({ subject: "user_cr_stranger" });
    await expect(
      stranger.mutation(api.conditionReports.create, {
        copyId,
        type: "damage_report",
        photos: [],
        description: "Fake damage report",
        newCondition: "worn",
      }),
    ).rejects.toThrow("Only the holder, sharer, or location staff can report condition");
  });

  it("damage report by sharer updates copy condition", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", {
        clerkId: "user_cr_sharer2",
        phone: "+3333333333",
        name: "Sharer",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 1,
        booksRead: 0,
        favoriteGenres: [],
      });
      const bookId = await ctx.db.insert("books", {
        title: "Damage Book",
        author: "Author",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 100,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });
      return await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        qrCodeUrl: "",
      });
    });

    const sharer = t.withIdentity({ subject: "user_cr_sharer2" });
    await sharer.mutation(api.conditionReports.create, {
      copyId,
      type: "damage_report",
      photos: [],
      description: "Spine is cracked",
      newCondition: "worn",
    });

    // Verify copy condition was updated
    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.condition).toBe("worn");

    // Verify report was created with correct fields
    const reports = await t.query(api.conditionReports.byCopy, { copyId });
    expect(reports).toHaveLength(1);
    expect(reports[0].previousCondition).toBe("good");
    expect(reports[0].newCondition).toBe("worn");
  });

  it("rejects empty description", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", {
        clerkId: "user_cr_desc",
        phone: "+4444444444",
        name: "Desc Tester",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 1,
        booksRead: 0,
        favoriteGenres: [],
      });
      const bookId = await ctx.db.insert("books", {
        title: "Desc Book",
        author: "Author",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 100,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });
      return await ctx.db.insert("copies", {
        bookId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: sharerId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_cr_desc" });
    await expect(
      authed.mutation(api.conditionReports.create, {
        copyId,
        type: "damage_report",
        photos: [],
        description: "   ",
        newCondition: "worn",
      }),
    ).rejects.toThrow("Description is required");
  });

  it("rejects description over 2000 characters", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", {
        clerkId: "user_cr_long",
        phone: "+1234567897",
        name: "Long Desc User",
        roles: ["reader"],
        status: "active",
        reputationScore: 100,
        booksShared: 1,
        booksRead: 0,
        favoriteGenres: [],
      });
      const bookId = await ctx.db.insert("books", {
        title: "Long Book", author: "Author", coverImage: "", description: "",
        categories: [], pageCount: 100, language: "English", avgRating: 0, reviewCount: 0,
      });
      return await ctx.db.insert("copies", {
        bookId, status: "available", condition: "good", ownershipType: "donated",
        originalSharerId: sharerId, qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_cr_long" });
    await expect(
      authed.mutation(api.conditionReports.create, {
        copyId,
        type: "damage_report",
        photos: [],
        description: "A".repeat(2001),
        newCondition: "worn",
      }),
    ).rejects.toThrow("Description must be 2000 characters or less");
  });

  it("byLocation returns reports for copies at a specific location", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", {
        clerkId: "user_cr_byloc", phone: "+1234567898", name: "Sharer",
        roles: ["reader"], status: "active", reputationScore: 50, booksShared: 1, booksRead: 0, favoriteGenres: [],
      });
      const bookId = await ctx.db.insert("books", {
        title: "Located Book", author: "Author", coverImage: "", description: "",
        categories: [], pageCount: 100, language: "English", avgRating: 0, reviewCount: 0,
      });
      const locId = await ctx.db.insert("partnerLocations", {
        name: "Report Cafe", address: "1 Main", lat: 0, lng: 0,
        contactPhone: "+1000000000", operatingHours: {}, photos: [],
        shelfCapacity: 50, currentBookCount: 1,
        managedByUserId: sharerId as unknown as string,
        staffUserIds: [], avgRating: 0, reviewCount: 0,
      });
      const copyId = await ctx.db.insert("copies", {
        bookId, status: "available", condition: "good", ownershipType: "donated",
        originalSharerId: sharerId, currentLocationId: locId, qrCodeUrl: "",
      });
      await ctx.db.insert("conditionReports", {
        copyId, reportedByUserId: sharerId, type: "pickup_check",
        photos: [], description: "Initial check", previousCondition: "good",
        newCondition: "good", createdAt: Date.now(),
      });
      return { locationId: locId };
    });

    const reports = await t.query(api.conditionReports.byLocation, { locationId });
    expect(reports).toHaveLength(1);
    expect(reports[0].description).toBe("Initial check");
  });

  it("listAll returns empty for non-admin users", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: "user_cr_nonadmin", phone: "+1234567899", name: "Reader",
        roles: ["reader"], status: "active", reputationScore: 50, booksShared: 0, booksRead: 0, favoriteGenres: [],
      });
    });

    const authed = t.withIdentity({ subject: "user_cr_nonadmin" });
    const result = await authed.query(api.conditionReports.listAll, {});
    expect(result).toEqual([]);
  });

  it("listAll returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.conditionReports.listAll, {});
    expect(result).toEqual([]);
  });
});
