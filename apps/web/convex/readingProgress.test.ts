import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_progress1",
    phone: "+1234567890",
    name: "Progress User",
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
    pageCount: 300,
    language: "English",
    avgRating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

function makeLocation(managedByUserId: Id<"users">) {
  return {
    name: "Test Location",
    address: "123 Test St",
    lat: 0,
    lng: 0,
    contactPhone: "+1111111111",
    photos: [],
    shelfCapacity: 50,
    currentBookCount: 0,
    managedByUserId,
    staffUserIds: [],
    operatingHours: {},
    avgRating: 0,
    reviewCount: 0,
  };
}

describe("readingProgress", () => {
  it("update creates new progress entry for held copy", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 50,
    });

    const progress = await authed.query(api.readingProgress.forCopy, {
      copyId,
    });
    expect(progress).not.toBeNull();
    expect(progress!.currentPage).toBe(50);
    expect(progress!.totalPages).toBe(300);
    expect(progress!.status).toBe("reading");
  });

  it("update patches existing progress entry", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 50,
    });
    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 150,
    });

    const progress = await authed.query(api.readingProgress.forCopy, {
      copyId,
    });
    expect(progress!.currentPage).toBe(150);
    expect(progress!.status).toBe("reading");
  });

  it("update auto-finishes when reaching last page", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert(
        "books",
        makeBook({ pageCount: 200 }),
      );
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 200,
    });

    const progress = await authed.query(api.readingProgress.forCopy, {
      copyId,
    });
    expect(progress!.status).toBe("finished");
    expect(progress!.finishedAt).toBeDefined();
  });

  it("update rejects page beyond total pages", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert(
        "books",
        makeBook({ pageCount: 200 }),
      );
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    await expect(
      authed.mutation(api.readingProgress.update, {
        copyId,
        currentPage: 250,
      }),
    ).rejects.toThrow("Current page cannot exceed total pages");
  });

  it("update rejects non-holder", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({
          clerkId: "user_progress2",
          name: "Other User",
          phone: "+9999999999",
        }),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const otherUser = t.withIdentity({ subject: "user_progress2" });

    await expect(
      otherUser.mutation(api.readingProgress.update, {
        copyId,
        currentPage: 10,
      }),
    ).rejects.toThrow("You are not the current holder");
  });

  it("update rejects negative page number", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    await expect(
      authed.mutation(api.readingProgress.update, {
        copyId,
        currentPage: -5,
      }),
    ).rejects.toThrow("Current page must be a non-negative integer");
  });

  it("currentlyReading returns active readings with book details", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert(
        "books",
        makeBook({ title: "Progress Book", author: "Progress Author" }),
      );
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 75,
    });

    const reading = await authed.query(api.readingProgress.currentlyReading, {});
    expect(reading).toHaveLength(1);
    expect(reading[0].bookTitle).toBe("Progress Book");
    expect(reading[0].bookAuthor).toBe("Progress Author");
    expect(reading[0].percentComplete).toBe(25);
    expect(reading[0].pagesRemaining).toBe(225);
  });

  it("currentlyReading excludes finished and abandoned entries", async () => {
    const t = convexTest(schema, modules);

    const { copyId1, copyId2 } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert(
        "books",
        makeBook({ pageCount: 100 }),
      );
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      const c1 = await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      const c2 = await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      return { copyId1: c1, copyId2: c2 };
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    // Finish one book
    await authed.mutation(api.readingProgress.update, {
      copyId: copyId1,
      currentPage: 100,
    });

    // Start reading another
    await authed.mutation(api.readingProgress.update, {
      copyId: copyId2,
      currentPage: 30,
    });

    const reading = await authed.query(api.readingProgress.currentlyReading, {});
    expect(reading).toHaveLength(1);
    expect(reading[0].currentPage).toBe(30);
  });

  it("abandon marks active reading as abandoned", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 50,
    });

    await authed.mutation(api.readingProgress.abandon, { copyId });

    const progress = await authed.query(api.readingProgress.forCopy, {
      copyId,
    });
    expect(progress!.status).toBe("abandoned");
  });

  it("myReadings returns all entries with optional status filter", async () => {
    const t = convexTest(schema, modules);

    const { copyId1, copyId2 } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert(
        "books",
        makeBook({ pageCount: 100 }),
      );
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      const c1 = await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      const c2 = await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      return { copyId1: c1, copyId2: c2 };
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    // Finish one, keep one active
    await authed.mutation(api.readingProgress.update, {
      copyId: copyId1,
      currentPage: 100,
    });
    await authed.mutation(api.readingProgress.update, {
      copyId: copyId2,
      currentPage: 30,
    });

    const all = await authed.query(api.readingProgress.myReadings, {});
    expect(all).toHaveLength(2);

    const finishedOnly = await authed.query(api.readingProgress.myReadings, {
      status: "finished",
    });
    expect(finishedOnly).toHaveLength(1);
    expect(finishedOnly[0].percentComplete).toBe(100);

    const readingOnly = await authed.query(api.readingProgress.myReadings, {
      status: "reading",
    });
    expect(readingOnly).toHaveLength(1);
    expect(readingOnly[0].percentComplete).toBe(30);
  });

  it("update rejects updating an abandoned reading", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 50,
    });
    await authed.mutation(api.readingProgress.abandon, { copyId });

    await expect(
      authed.mutation(api.readingProgress.update, {
        copyId,
        currentPage: 60,
      }),
    ).rejects.toThrow("Cannot update a reading that is abandoned");
  });

  it("update rejects updating a finished reading", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert(
        "books",
        makeBook({ pageCount: 100 }),
      );
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    // Finish the book
    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 100,
    });

    await expect(
      authed.mutation(api.readingProgress.update, {
        copyId,
        currentPage: 50,
      }),
    ).rejects.toThrow("Cannot update a reading that is finished");
  });

  it("update rejects unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    await expect(
      t.mutation(api.readingProgress.update, {
        copyId,
        currentPage: 10,
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("forUser returns finished readings sorted by finishedAt desc", async () => {
    const t = convexTest(schema, modules);

    let userId: Id<"users">;

    await t.run(async (ctx) => {
      userId = await ctx.db.insert("users", makeUser());
      const bookId1 = await ctx.db.insert(
        "books",
        makeBook({ title: "First Book", author: "Author A", pageCount: 100 }),
      );
      const bookId2 = await ctx.db.insert(
        "books",
        makeBook({ title: "Second Book", author: "Author B", pageCount: 200 }),
      );
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      const copyId1 = await ctx.db.insert("copies", {
        bookId: bookId1,
        status: "checked_out" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      const copyId2 = await ctx.db.insert("copies", {
        bookId: bookId2,
        status: "checked_out" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      // Older finished reading
      await ctx.db.insert("readingProgress", {
        userId,
        copyId: copyId1,
        bookId: bookId1,
        currentPage: 100,
        totalPages: 100,
        status: "finished" as const,
        startedAt: Date.now() - 30 * 86400000,
        lastUpdatedAt: Date.now() - 20 * 86400000,
        finishedAt: Date.now() - 20 * 86400000,
      });
      // Newer finished reading
      await ctx.db.insert("readingProgress", {
        userId,
        copyId: copyId2,
        bookId: bookId2,
        currentPage: 200,
        totalPages: 200,
        status: "finished" as const,
        startedAt: Date.now() - 10 * 86400000,
        lastUpdatedAt: Date.now() - 2 * 86400000,
        finishedAt: Date.now() - 2 * 86400000,
      });
      // Active reading (should NOT appear)
      const bookId3 = await ctx.db.insert(
        "books",
        makeBook({ title: "Still Reading", pageCount: 300 }),
      );
      const copyId3 = await ctx.db.insert("copies", {
        bookId: bookId3,
        status: "checked_out" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      await ctx.db.insert("readingProgress", {
        userId,
        copyId: copyId3,
        bookId: bookId3,
        currentPage: 50,
        totalPages: 300,
        status: "reading" as const,
        startedAt: Date.now() - 5 * 86400000,
        lastUpdatedAt: Date.now(),
      });
    });

    const result = await t.query(api.readingProgress.forUser, { userId: userId! });
    expect(result).toHaveLength(2);
    // Newest first
    expect(result[0].bookTitle).toBe("Second Book");
    expect(result[1].bookTitle).toBe("First Book");
    expect(result[0].totalPages).toBe(200);
    expect(result[0].finishedAt).toBeDefined();
  });

  it("forUser excludes finished readings where the book was deleted", async () => {
    const t = convexTest(schema, modules);

    let userId: Id<"users">;

    await t.run(async (ctx) => {
      userId = await ctx.db.insert("users", makeUser());
      const bookId1 = await ctx.db.insert(
        "books",
        makeBook({ title: "Kept Book", pageCount: 100 }),
      );
      const deletedBookId = await ctx.db.insert(
        "books",
        makeBook({ title: "Deleted Book", pageCount: 200 }),
      );
      const locId = await ctx.db.insert("partnerLocations", {
        name: "Cafe", address: "1 Main", lat: 0, lng: 0,
        contactPhone: "+1000000000", operatingHours: {}, photos: [],
        shelfCapacity: 50, currentBookCount: 0,
        managedByUserId: userId as unknown as string,
        staffUserIds: [], avgRating: 0, reviewCount: 0,
      });
      const copyId1 = await ctx.db.insert("copies", {
        bookId: bookId1, status: "available" as const, condition: "good" as const,
        ownershipType: "lent" as const, originalSharerId: userId,
        currentLocationId: locId, qrCodeUrl: "",
      });
      const copyId2 = await ctx.db.insert("copies", {
        bookId: deletedBookId, status: "available" as const, condition: "good" as const,
        ownershipType: "lent" as const, originalSharerId: userId,
        currentLocationId: locId, qrCodeUrl: "",
      });
      // Finished reading for kept book
      await ctx.db.insert("readingProgress", {
        userId, copyId: copyId1, bookId: bookId1,
        currentPage: 100, totalPages: 100, status: "finished" as const,
        startedAt: Date.now() - 86400000, lastUpdatedAt: Date.now(),
        finishedAt: Date.now(),
      });
      // Finished reading for book that will be deleted
      await ctx.db.insert("readingProgress", {
        userId, copyId: copyId2, bookId: deletedBookId,
        currentPage: 200, totalPages: 200, status: "finished" as const,
        startedAt: Date.now() - 86400000, lastUpdatedAt: Date.now(),
        finishedAt: Date.now() - 3600000,
      });
      // Delete the second book
      await ctx.db.delete(deletedBookId);
    });

    const result = await t.query(api.readingProgress.forUser, { userId: userId! });
    expect(result).toHaveLength(1);
    expect(result[0].bookTitle).toBe("Kept Book");
  });

  it("currentlyReading returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.readingProgress.currentlyReading, {});
    expect(result).toEqual([]);
  });

  it("forCopy returns reading progress for a specific copy", async () => {
    const t = convexTest(schema, modules);

    let copyId: any;

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook({ pageCount: 300 }));
      const locId = await ctx.db.insert("partnerLocations", {
        name: "Test Cafe",
        address: "123 Main",
        lat: 0,
        lng: 0,
        contactPhone: "+1000000000",
        operatingHours: {},
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 0,
        managedByUserId: userId as unknown as string,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
      copyId = await ctx.db.insert("copies", {
        bookId,
        status: "checked_out" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        currentHolderId: userId,
        qrCodeUrl: "qr_forcopy",
      });
      await ctx.db.insert("readingProgress", {
        userId,
        copyId,
        bookId,
        currentPage: 150,
        totalPages: 300,
        status: "reading" as const,
        startedAt: Date.now() - 5 * 86400000,
        lastUpdatedAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });
    const progress = await authed.query(api.readingProgress.forCopy, { copyId });
    expect(progress).not.toBeNull();
    expect(progress!.currentPage).toBe(150);
    expect(progress!.totalPages).toBe(300);
    expect(progress!.status).toBe("reading");
  });

  it("update rejects nonexistent copy", async () => {
    const t = convexTest(schema, modules);

    const fakeCopyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      const cId = await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
      await ctx.db.delete(cId);
      return cId;
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    await expect(
      authed.mutation(api.readingProgress.update, {
        copyId: fakeCopyId,
        currentPage: 10,
      }),
    ).rejects.toThrow("Copy not found");
  });

  it("abandon rejects when no reading progress exists", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    await expect(
      authed.mutation(api.readingProgress.abandon, { copyId }),
    ).rejects.toThrow("No reading progress found for this copy");
  });

  it("abandon rejects when reading is already abandoned", async () => {
    const t = convexTest(schema, modules);

    const copyId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId),
      );
      return await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: userId,
        currentHolderId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });
    });

    const authed = t.withIdentity({ subject: "user_progress1" });

    await authed.mutation(api.readingProgress.update, {
      copyId,
      currentPage: 50,
    });
    await authed.mutation(api.readingProgress.abandon, { copyId });

    await expect(
      authed.mutation(api.readingProgress.abandon, { copyId }),
    ).rejects.toThrow("Can only abandon an active reading");
  });
});
