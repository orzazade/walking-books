import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_yir1",
    phone: "+1234567890",
    name: "Review User",
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
    address: "123 Test St",
    lat: 0,
    lng: 0,
    contactPhone: "+1234567890",
    operatingHours: {},
    photos: [],
    shelfCapacity: 100,
    currentBookCount: 0,
    managedByUserId,
    staffUserIds: [],
    avgRating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

// Helper: timestamp for a specific date in a given year
function ts(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getTime();
}

describe("yearInReview", () => {
  it("returns null for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.yearInReview.getReview, { year: 2025 });
    expect(result).toBeNull();
  });

  it("returns zero stats when no reads in the year", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });

    const result = await t.withIdentity({ subject: "user_yir1" }).query(
      api.yearInReview.getReview,
      { year: 2025 },
    );

    expect(result).not.toBeNull();
    expect(result!.totalBooksRead).toBe(0);
    expect(result!.totalPagesRead).toBe(0);
    expect(result!.avgDaysPerBook).toBeNull();
    expect(result!.topGenres).toEqual([]);
    expect(result!.monthlyActivity).toHaveLength(12);
    expect(result!.reviewsWritten).toBe(0);
  });

  it("counts books read and pages in the specified year", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as string),
      );
      const bookId = await ctx.db.insert(
        "books",
        makeBook({ pageCount: 300 }),
      );
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });

      // Completed read in 2025
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: ts(2025, 3, 1),
        returnedAt: ts(2025, 3, 15),
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });

      // Completed read in 2024 (should not count for 2025)
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: ts(2024, 6, 1),
        returnedAt: ts(2024, 6, 20),
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
    });

    const result = await t.withIdentity({ subject: "user_yir1" }).query(
      api.yearInReview.getReview,
      { year: 2025 },
    );

    expect(result!.totalBooksRead).toBe(1);
    expect(result!.totalPagesRead).toBe(300);
    expect(result!.avgDaysPerBook).toBe(14);
  });

  it("computes genre breakdown and most read author", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as string),
      );
      const book1 = await ctx.db.insert(
        "books",
        makeBook({
          title: "Mystery A",
          author: "Jane Doe",
          categories: ["mystery", "thriller"],
        }),
      );
      const book2 = await ctx.db.insert(
        "books",
        makeBook({
          title: "Mystery B",
          author: "Jane Doe",
          categories: ["mystery"],
        }),
      );
      const book3 = await ctx.db.insert(
        "books",
        makeBook({
          title: "Sci-Fi C",
          author: "John Smith",
          categories: ["sci-fi"],
        }),
      );

      for (const bookId of [book1, book2, book3]) {
        const copyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "lent" as const,
          originalSharerId: userId,
          currentLocationId: locId,
          qrCodeUrl: "",
        });

        await ctx.db.insert("journeyEntries", {
          copyId,
          readerId: userId,
          pickupLocationId: locId,
          pickedUpAt: ts(2025, 1, 1),
          returnedAt: ts(2025, 1, 10),
          pickupPhotos: [],
          returnPhotos: [],
          conditionAtPickup: "good" as const,
        });
      }
    });

    const result = await t.withIdentity({ subject: "user_yir1" }).query(
      api.yearInReview.getReview,
      { year: 2025 },
    );

    expect(result!.topGenres[0].genre).toBe("mystery");
    expect(result!.topGenres[0].count).toBe(2);
    expect(result!.mostReadAuthor).toEqual({ author: "Jane Doe", count: 2 });
  });

  it("builds correct monthly activity", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as string),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });

      // Two reads returned in March 2025
      for (let i = 0; i < 2; i++) {
        await ctx.db.insert("journeyEntries", {
          copyId,
          readerId: userId,
          pickupLocationId: locId,
          pickedUpAt: ts(2025, 3, 1 + i * 5),
          returnedAt: ts(2025, 3, 5 + i * 5),
          pickupPhotos: [],
          returnPhotos: [],
          conditionAtPickup: "good" as const,
        });
      }
    });

    const result = await t.withIdentity({ subject: "user_yir1" }).query(
      api.yearInReview.getReview,
      { year: 2025 },
    );

    // March is index 2
    expect(result!.monthlyActivity[2].count).toBe(2);
    expect(result!.monthlyActivity[2].month).toBe("Mar 2025");
    // Other months should be 0
    expect(result!.monthlyActivity[0].count).toBe(0);
  });

  it("counts unique locations and top locations", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const loc1 = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as string, { name: "Library A" }),
      );
      const loc2 = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as string, { name: "Cafe B" }),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: loc1,
        qrCodeUrl: "",
      });

      // 2 pickups from loc1, 1 from loc2
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: loc1,
        pickedUpAt: ts(2025, 2, 1),
        returnedAt: ts(2025, 2, 10),
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: loc1,
        pickedUpAt: ts(2025, 3, 1),
        returnedAt: ts(2025, 3, 10),
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: loc2,
        pickedUpAt: ts(2025, 4, 1),
        returnedAt: ts(2025, 4, 10),
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });
    });

    const result = await t.withIdentity({ subject: "user_yir1" }).query(
      api.yearInReview.getReview,
      { year: 2025 },
    );

    expect(result!.uniqueLocationsVisited).toBe(2);
    expect(result!.topLocations[0]).toEqual({ name: "Library A", count: 2 });
    expect(result!.topLocations[1]).toEqual({ name: "Cafe B", count: 1 });
  });

  it("includes reviews written and average rating", async () => {
    const t = convexTest(schema, modules);
    // Reviews use _creationTime for year filtering, which is set to Date.now()
    // by convex-test, so we must query the current year
    const currentYear = new Date().getFullYear();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as string),
      );
      const book1 = await ctx.db.insert("books", makeBook({ title: "Book A" }));
      const book2 = await ctx.db.insert("books", makeBook({ title: "Book B" }));
      const copyId = await ctx.db.insert("copies", {
        bookId: book1,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });

      await ctx.db.insert("journeyEntries", {
        copyId,
        readerId: userId,
        pickupLocationId: locId,
        pickedUpAt: ts(currentYear, 1, 1),
        returnedAt: ts(currentYear, 1, 10),
        pickupPhotos: [],
        returnPhotos: [],
        conditionAtPickup: "good" as const,
      });

      await ctx.db.insert("reviews", {
        bookId: book1,
        userId,
        rating: 4,
        text: "Great book",
      });
      await ctx.db.insert("reviews", {
        bookId: book2,
        userId,
        rating: 5,
        text: "Amazing",
      });
    });

    const result = await t.withIdentity({ subject: "user_yir1" }).query(
      api.yearInReview.getReview,
      { year: currentYear },
    );

    expect(result!.reviewsWritten).toBe(2);
    expect(result!.avgRatingGiven).toBe(4.5);
  });

  it("finds the fastest read", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as string),
      );
      const fastBook = await ctx.db.insert(
        "books",
        makeBook({ title: "Quick Read", author: "Speedy Writer" }),
      );
      const slowBook = await ctx.db.insert(
        "books",
        makeBook({ title: "Slow Read" }),
      );

      for (const [bookId, pickup, ret] of [
        [fastBook, ts(2025, 5, 1), ts(2025, 5, 3)] as const,
        [slowBook, ts(2025, 6, 1), ts(2025, 6, 20)] as const,
      ]) {
        const copyId = await ctx.db.insert("copies", {
          bookId,
          status: "available" as const,
          condition: "good" as const,
          ownershipType: "lent" as const,
          originalSharerId: userId,
          currentLocationId: locId,
          qrCodeUrl: "",
        });
        await ctx.db.insert("journeyEntries", {
          copyId,
          readerId: userId,
          pickupLocationId: locId,
          pickedUpAt: pickup,
          returnedAt: ret,
          pickupPhotos: [],
          returnPhotos: [],
          conditionAtPickup: "good" as const,
        });
      }
    });

    const result = await t.withIdentity({ subject: "user_yir1" }).query(
      api.yearInReview.getReview,
      { year: 2025 },
    );

    expect(result!.fastestRead).toEqual({
      title: "Quick Read",
      author: "Speedy Writer",
      days: 2,
    });
  });

  it("includes reading goal progress", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId as string),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const copyId = await ctx.db.insert("copies", {
        bookId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "lent" as const,
        originalSharerId: userId,
        currentLocationId: locId,
        qrCodeUrl: "",
      });

      // Set goal: 10 books for 2025
      await ctx.db.insert("readingGoals", {
        userId,
        year: 2025,
        targetBooks: 10,
      });

      // Complete 3 books
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("journeyEntries", {
          copyId,
          readerId: userId,
          pickupLocationId: locId,
          pickedUpAt: ts(2025, 1 + i, 1),
          returnedAt: ts(2025, 1 + i, 10),
          pickupPhotos: [],
          returnPhotos: [],
          conditionAtPickup: "good" as const,
        });
      }
    });

    const result = await t.withIdentity({ subject: "user_yir1" }).query(
      api.yearInReview.getReview,
      { year: 2025 },
    );

    expect(result!.goalTarget).toBe(10);
    expect(result!.goalProgress).toBe(30);
  });

  it("rejects invalid year", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    await expect(
      t.withIdentity({ subject: "user_yir1" }).query(
        api.yearInReview.getReview,
        { year: 1999 },
      ),
    ).rejects.toThrow("Invalid year");
  });
});
