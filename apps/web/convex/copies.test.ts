import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_copies1",
    phone: "+1234567890",
    name: "Test User",
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
    coverImage: "https://example.com/cover.jpg",
    description: "A test book",
    categories: ["fiction"],
    pageCount: 200,
    language: "English",
    avgRating: 4.0,
    reviewCount: 2,
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

function makeCopy(
  bookId: string,
  locationId: string,
  sharerId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    bookId,
    currentLocationId: locationId,
    originalSharerId: sharerId,
    status: "available" as const,
    condition: "good" as const,
    ownershipType: "lent" as const,
    lendingPeriodDays: 21,
    qrCodeUrl: "",
    ...overrides,
  };
}

describe("copies.byLocationWithBooks", () => {
  it("returns empty when no copies at location", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });

    const result = await t.query(api.copies.byLocationWithBooks, { locationId: locId });
    expect(result).toEqual([]);
  });

  it("returns copies enriched with book metadata", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook({ title: "My Book", author: "Jane Doe" }));
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId));
    });

    const result = await t.query(api.copies.byLocationWithBooks, { locationId: locId });
    expect(result).toHaveLength(1);
    expect(result[0].book.title).toBe("My Book");
    expect(result[0].book.author).toBe("Jane Doe");
    expect(result[0].book._id).toBe(bookId);
    expect(result[0].book.coverImage).toBe("https://example.com/cover.jpg");
    expect(result[0].book.avgRating).toBe(4.0);
    expect(result[0].book.categories).toEqual(["fiction"]);
  });

  it("excludes non-available copies", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId, { status: "checked_out" }));
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId, { status: "available" }));
    });

    const result = await t.query(api.copies.byLocationWithBooks, { locationId: locId });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("available");
  });

  it("returns multiple copies with different books", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });
    const book1 = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook({ title: "Book A", author: "Author A" }));
    });
    const book2 = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook({ title: "Book B", author: "Author B" }));
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(book1, locId, userId));
      await ctx.db.insert("copies", makeCopy(book2, locId, userId));
    });

    const result = await t.query(api.copies.byLocationWithBooks, { locationId: locId });
    expect(result).toHaveLength(2);
    const titles = result.map((r: { book: { title: string } }) => r.book.title).sort();
    expect(titles).toEqual(["Book A", "Book B"]);
  });

  it("does not return copies from other locations", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const loc1 = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId, { name: "Location 1" }));
    });
    const loc2 = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId, { name: "Location 2" }));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, loc1, userId));
      await ctx.db.insert("copies", makeCopy(bookId, loc2, userId));
    });

    const result1 = await t.query(api.copies.byLocationWithBooks, { locationId: loc1 });
    expect(result1).toHaveLength(1);

    const result2 = await t.query(api.copies.byLocationWithBooks, { locationId: loc2 });
    expect(result2).toHaveLength(1);
  });

  it("deduplicates book fetches for multiple copies of same book", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook({ title: "Same Book" }));
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId));
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId));
    });

    const result = await t.query(api.copies.byLocationWithBooks, { locationId: locId });
    expect(result).toHaveLength(2);
    expect(result[0].book.title).toBe("Same Book");
    expect(result[1].book.title).toBe("Same Book");
    expect(result[0].book._id).toBe(result[1].book._id);
  });
});

describe("copies.byBookEnriched", () => {
  it("returns copies enriched with location name and address", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId, { name: "Sunrise Cafe", address: "42 Oak Lane" }),
      );
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId));
    });

    const result = await t.query(api.copies.byBookEnriched, { bookId });
    expect(result).toHaveLength(1);
    expect(result[0].location).toEqual({
      name: "Sunrise Cafe",
      address: "42 Oak Lane",
      operatingHours: {},
    });
  });

  it("returns null location for copies without a currentLocationId", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(userId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, userId, {
          currentLocationId: undefined,
          status: "checked_out",
        }),
      );
    });

    const result = await t.query(api.copies.byBookEnriched, { bookId });
    expect(result).toHaveLength(1);
    expect(result[0].location).toBeNull();
  });

  it("deduplicates location fetches for copies at the same location", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId, { name: "Hub Library" }),
      );
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId));
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId));
    });

    const result = await t.query(api.copies.byBookEnriched, { bookId });
    expect(result).toHaveLength(2);
    expect(result[0].location?.name).toBe("Hub Library");
    expect(result[1].location?.name).toBe("Hub Library");
  });

  it("includes operatingHours in enriched location data", async () => {
    const t = convexTest(schema, modules);
    const hours = { mon: "09:00-18:00", tue: "09:00-18:00", wed: "09:00-18:00" };
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "partnerLocations",
        makeLocation(userId, { name: "Hours Cafe", operatingHours: hours }),
      );
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, locId, userId));
    });

    const result = await t.query(api.copies.byBookEnriched, { bookId });
    expect(result).toHaveLength(1);
    expect(result[0].location?.operatingHours).toEqual(hours);
  });

});

describe("copies.bySharerEnriched", () => {
  it("returns copies enriched with book, location, and holder details", async () => {
    const t = convexTest(schema, modules);
    const sharerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_sharer_enr" }));
    });
    const holderId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_holder_enr", name: "Jane Reader", avatarUrl: "https://example.com/avatar.jpg" }),
      );
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(sharerId, { name: "Cafe Bookshelf", address: "42 Oak Ave" }));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook({ title: "Shared Novel", author: "Alice Writer" }));
    });
    // Available copy at location
    await t.run(async (ctx) => {
      await ctx.db.insert("copies", makeCopy(bookId, locId, sharerId));
    });
    // Checked-out copy with holder
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sharerId, { status: "checked_out", currentHolderId: holderId }),
      );
    });

    const authed = t.withIdentity({ subject: "user_sharer_enr" });
    const result = await authed.query(api.copies.bySharerEnriched, {});

    expect(result).toHaveLength(2);
    // Both copies should have enriched book info
    expect(result[0].bookTitle).toBe("Shared Novel");
    expect(result[0].bookAuthor).toBe("Alice Writer");
    expect(result[0].locationName).toBe("Cafe Bookshelf");
    expect(result[0].locationAddress).toBe("42 Oak Ave");

    // Find the checked-out copy and verify holder enrichment
    const checkedOut = result.find((c) => c.status === "checked_out");
    expect(checkedOut).toBeDefined();
    expect(checkedOut!.holderName).toBe("Jane Reader");
    expect(checkedOut!.holderAvatar).toBe("https://example.com/avatar.jpg");
  });

  it("returns empty array for user with no shared copies", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_no_copies" }));
    });

    const authed = t.withIdentity({ subject: "user_no_copies" });
    const result = await authed.query(api.copies.bySharerEnriched, {});
    expect(result).toEqual([]);
  });
});

describe("copies.extend", () => {
  it("rejects after maximum extensions reached", async () => {
    const t = convexTest(schema, modules);
    const holderId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_extend" }));
    });
    const sharerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_sharer_ext" }));
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(sharerId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    const copyId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sharerId, {
          status: "checked_out",
          currentHolderId: holderId,
          returnDeadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
          extensionCount: 2,
        }),
      );
    });

    const authed = t.withIdentity({ subject: "user_extend" });
    await expect(
      authed.mutation(api.copies.extend, { copyId }),
    ).rejects.toThrow("Maximum 2 extensions allowed");
  });
});

describe("copies.pickup", () => {
  it("picks up an available copy and creates journey entry", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_pickup_sharer", name: "Sharer" }),
      );
      await ctx.db.insert("users", makeUser({ clerkId: "user_pickup_reader" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId, { currentBookCount: 5 }),
      );
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sharerId),
      );
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_pickup_reader" });
    await authed.mutation(api.copies.pickup, {
      copyId,
      locationId,
      conditionAtPickup: "good",
      photos: [],
    });

    // Copy should now be checked out
    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.status).toBe("checked_out");
    expect(copy!.extensionCount).toBe(0);
  });

  it("rejects pickup of checked-out copy", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_pickup_sharer2", name: "Sharer2" }),
      );
      await ctx.db.insert("users", makeUser({ clerkId: "user_pickup_fail" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId, { currentBookCount: 5 }),
      );
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sharerId, {
          status: "checked_out",
          currentHolderId: sharerId,
        }),
      );
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_pickup_fail" });
    await expect(
      authed.mutation(api.copies.pickup, {
        copyId,
        locationId,
        conditionAtPickup: "good",
        photos: [],
      }),
    ).rejects.toThrow("Copy not available for pickup");
  });

  it("rejects pickup when reputation is too low", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_pickup_sharer3", name: "Sharer3" }),
      );
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_low_rep", reputationScore: 10 }),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId, { currentBookCount: 5 }),
      );
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sharerId),
      );
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_low_rep" });
    await expect(
      authed.mutation(api.copies.pickup, {
        copyId,
        locationId,
        conditionAtPickup: "good",
        photos: [],
      }),
    ).rejects.toThrow("reputation is too low");
  });
});

describe("copies.relist", () => {
  it("sharer can relist a recalled copy as available", async () => {
    const t = convexTest(schema, modules);
    const sharerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_relist_sharer" }));
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(sharerId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    const copyId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sharerId, { status: "recalled" }),
      );
    });

    const authed = t.withIdentity({ subject: "user_relist_sharer" });
    await authed.mutation(api.copies.relist, { copyId });

    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.status).toBe("available");
  });

  it("rejects relist for non-recalled copies", async () => {
    const t = convexTest(schema, modules);
    const sharerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_relist_fail" }));
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(sharerId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    const copyId = await t.run(async (ctx) => {
      return await ctx.db.insert("copies", makeCopy(bookId, locId, sharerId));
    });

    const authed = t.withIdentity({ subject: "user_relist_fail" });
    await expect(
      authed.mutation(api.copies.relist, { copyId }),
    ).rejects.toThrow("Only recalled copies can be relisted");
  });
});
