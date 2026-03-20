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
  it("extends the return deadline successfully", async () => {
    const t = convexTest(schema, modules);
    const holderId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_extend_ok" }));
    });
    const sharerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_sharer_ext_ok" }));
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(sharerId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    const originalDeadline = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const copyId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sharerId, {
          status: "checked_out",
          currentHolderId: holderId,
          returnDeadline: originalDeadline,
          extensionCount: 0,
        }),
      );
    });

    const authed = t.withIdentity({ subject: "user_extend_ok" });
    const result = await authed.mutation(api.copies.extend, { copyId });
    expect(result.success).toBe(true);
    expect(result.newDeadline).toBeGreaterThan(originalDeadline);

    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.extensionCount).toBe(1);
  });

  it("rejects extension when active reservation exists", async () => {
    const t = convexTest(schema, modules);
    const holderId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_extend_res" }));
    });
    const sharerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_sharer_ext_res" }));
    });
    const reserverId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_reserver_ext", phone: "+7777777777" }));
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
          extensionCount: 0,
        }),
      );
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("reservations", {
        copyId,
        userId: reserverId,
        locationId: locId,
        status: "active" as const,
        expiresAt: Date.now() + 86400000,
        reservedAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: "user_extend_res" });
    await expect(
      authed.mutation(api.copies.extend, { copyId }),
    ).rejects.toThrow("Cannot extend: there is an active reservation");
  });

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

describe("copies.returnCopy", () => {
  it("returns a checked-out copy and makes it available", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_return_sharer", name: "Sharer" }),
      );
      const holderId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_return_holder", name: "Holder" }),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId, { currentBookCount: 3 }),
      );
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sharerId, {
          status: "checked_out",
          currentHolderId: holderId,
          returnDeadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }),
      );
      // Journey entry required for returnCopy
      await ctx.db.insert("journeyEntries", {
        copyId: cId,
        readerId: holderId,
        pickupLocationId: locId,
        pickedUpAt: Date.now() - 86400000,
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_return_holder" });
    await authed.mutation(api.copies.returnCopy, {
      copyId,
      locationId,
      conditionAtReturn: "good",
      photos: [],
    });

    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.status).toBe("available");
    expect(copy!.currentHolderId).toBeUndefined();
  });

  it("on-time return with good condition increases reputation by 5", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId, holderId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_rep_sharer", name: "Sharer", phone: "+1111111111" }),
      );
      const hId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_rep_holder", name: "Holder", reputationScore: 50 }),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sId, { currentBookCount: 3 }),
      );
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sId, {
          status: "checked_out",
          currentHolderId: hId,
          returnDeadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // due in 7 days (on time)
        }),
      );
      await ctx.db.insert("journeyEntries", {
        copyId: cId,
        readerId: hId,
        pickupLocationId: locId,
        pickedUpAt: Date.now() - 86400000,
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      return { copyId: cId, locationId: locId, holderId: hId };
    });

    const authed = t.withIdentity({ subject: "user_rep_holder" });
    await authed.mutation(api.copies.returnCopy, {
      copyId,
      locationId,
      conditionAtReturn: "good",
      photos: [],
    });

    // On-time (+3) + good condition (+2) = +5
    const holder = await t.run(async (ctx) => ctx.db.get(holderId));
    expect(holder!.reputationScore).toBe(55);
  });

  it("late return with good condition decreases reputation by 3", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId, holderId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_late_sharer", name: "Sharer", phone: "+2222222222" }),
      );
      const hId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_late_holder", name: "Holder", reputationScore: 50 }),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sId, { currentBookCount: 3 }),
      );
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sId, {
          status: "checked_out",
          currentHolderId: hId,
          returnDeadline: Date.now() - 86400000, // deadline was yesterday (late)
        }),
      );
      await ctx.db.insert("journeyEntries", {
        copyId: cId,
        readerId: hId,
        pickupLocationId: locId,
        pickedUpAt: Date.now() - 7 * 86400000,
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      return { copyId: cId, locationId: locId, holderId: hId };
    });

    const authed = t.withIdentity({ subject: "user_late_holder" });
    await authed.mutation(api.copies.returnCopy, {
      copyId,
      locationId,
      conditionAtReturn: "good",
      photos: [],
    });

    // Late (-5) + good condition (+2) = -3, so 50 - 3 = 47
    const holder = await t.run(async (ctx) => ctx.db.get(holderId));
    expect(holder!.reputationScore).toBe(47);
  });

  it("rejects return by non-holder", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_return_sharer2", name: "Sharer2" }),
      );
      const holderId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_return_holder2", name: "Holder2" }),
      );
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_return_other", name: "Other", phone: "+9999999999" }),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert(
        "partnerLocations",
        makeLocation(sharerId, { currentBookCount: 3 }),
      );
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sharerId, {
          status: "checked_out",
          currentHolderId: holderId,
        }),
      );
      return { copyId: cId, locationId: locId };
    });

    const other = t.withIdentity({ subject: "user_return_other" });
    await expect(
      other.mutation(api.copies.returnCopy, {
        copyId,
        locationId,
        conditionAtReturn: "good",
        photos: [],
      }),
    ).rejects.toThrow("You are not the current holder");
  });
});

describe("copies.recall", () => {
  it("sharer recalls an available copy", async () => {
    const t = convexTest(schema, modules);
    const sharerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_recall_sharer" }));
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

    const authed = t.withIdentity({ subject: "user_recall_sharer" });
    const result = await authed.mutation(api.copies.recall, { copyId });
    expect(result).toEqual({ success: true });

    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.status).toBe("recalled");
  });

  it("sharer recalls a reserved copy and cancels the reservation", async () => {
    const t = convexTest(schema, modules);
    const sharerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_recall_sharer2" }));
    });
    const readerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_recall_reserver", phone: "+9876543210" }));
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(sharerId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    const copyId = await t.run(async (ctx) => {
      return await ctx.db.insert("copies", makeCopy(bookId, locId, sharerId, { status: "reserved" }));
    });
    const reservationId = await t.run(async (ctx) => {
      return await ctx.db.insert("reservations", {
        copyId,
        userId: readerId,
        locationId: locId,
        status: "active" as const,
        expiresAt: Date.now() + 86400000,
        reservedAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: "user_recall_sharer2" });
    await authed.mutation(api.copies.recall, { copyId });

    const [copy, reservation] = await t.run(async (ctx) => {
      return [await ctx.db.get(copyId), await ctx.db.get(reservationId)];
    });
    expect(copy!.status).toBe("recalled");
    expect(reservation!.status).toBe("cancelled");
  });

  it("sharer recalls a checked-out copy and sets grace deadline", async () => {
    const t = convexTest(schema, modules);
    const sharerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_recall_sharer3" }));
    });
    const holderId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_recall_holder", phone: "+5555555555" }));
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(sharerId));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    const farDeadline = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days out
    const copyId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "copies",
        makeCopy(bookId, locId, sharerId, {
          status: "checked_out",
          currentHolderId: holderId,
          returnDeadline: farDeadline,
        }),
      );
    });

    const authed = t.withIdentity({ subject: "user_recall_sharer3" });
    await authed.mutation(api.copies.recall, { copyId });

    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.status).toBe("recalled");
    // Grace deadline should be shorter than the original far deadline
    expect(copy!.returnDeadline).toBeLessThan(farDeadline);
  });

  it("rejects recall by non-sharer", async () => {
    const t = convexTest(schema, modules);
    const sharerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_recall_owner" }));
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_recall_stranger", phone: "+1111111111" }));
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

    const stranger = t.withIdentity({ subject: "user_recall_stranger" });
    await expect(
      stranger.mutation(api.copies.recall, { copyId }),
    ).rejects.toThrow("Only the sharer can recall");
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

  it("rejects pickup of reserved copy without reservation ID", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_resv_sharer", name: "Reserver Sharer" }),
      );
      const readerId = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_reserver", name: "Reserver" }),
      );
      // Third user who will try to pick up without reservation
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_pickup_norez", name: "No Reservation" }),
      );
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "reserved",
        }),
      );
      // Create a reservation by the reserver
      await ctx.db.insert("reservations", {
        copyId: cId,
        userId: readerId,
        locationId: locId,
        reservedAt: Date.now(),
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
        status: "active",
      });
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "user_pickup_norez" });
    await expect(
      authed.mutation(api.copies.pickup, { copyId, locationId, conditionAtPickup: "good", photos: [] }),
    ).rejects.toThrow("This copy is reserved — a reservation ID is required");
  });
});
