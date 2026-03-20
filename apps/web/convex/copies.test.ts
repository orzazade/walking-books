import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";

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

  it("pickup resets extensionCount to 0 on previously-extended copy", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_extres", phone: "+9393939391" }));
      await ctx.db.insert("users", makeUser({ clerkId: "reader_extres", phone: "+9393939392" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string, { currentBookCount: 3 }));
      // Copy that was previously checked out with 2 extensions, now available again
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          extensionCount: 2,
        }),
      );
      return { copyId: cId, locationId: locId };
    });

    const reader = t.withIdentity({ subject: "reader_extres" });
    await reader.mutation(api.copies.pickup, {
      copyId,
      locationId,
      conditionAtPickup: "good",
      photos: [],
    });

    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.extensionCount).toBe(0);
    expect(copy!.status).toBe("checked_out");
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

  it("rejects returning a copy that is not checked out", async () => {
    const t = convexTest(schema, modules);

    const sharerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser({ clerkId: "user_return_status" }));
    });
    const locId = await t.run(async (ctx) => {
      return await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
    });
    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });
    const copyId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string),
      );
    });

    const authed = t.withIdentity({ subject: "user_return_status" });
    await expect(
      authed.mutation(api.copies.returnCopy, {
        copyId,
        locationId: locId,
        conditionAtReturn: "good",
        photos: [],
      }),
    ).rejects.toThrow("Copy is not checked out");
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

  it("recall of checked-out copy creates notification for holder", async () => {
    const t = convexTest(schema, modules);

    const { copyId, holderId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_recnotif", phone: "+9191919191" }));
      const hId = await ctx.db.insert("users", makeUser({ clerkId: "holder_recnotif", phone: "+9191919192" }));
      const bookId = await ctx.db.insert("books", makeBook({ title: "Recalled Book" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sId as unknown as string, {
          status: "checked_out",
          currentHolderId: hId,
          returnDeadline: Date.now() + 30 * 86400000,
        }),
      );
      return { copyId: cId, holderId: hId };
    });

    const sharer = t.withIdentity({ subject: "sharer_recnotif" });
    await sharer.mutation(api.copies.recall, { copyId });

    // Verify notification was created for the holder
    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("userNotifications")
        .withIndex("by_user", (q) => q.eq("userId", holderId))
        .collect();
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("book_recalled");
    expect(notifications[0].title).toBe("Book recalled by owner");
    expect(notifications[0].message).toContain("Recalled Book");
  });

  it("returnCopy of recalled copy preserves recalled status", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_retrecall", phone: "+9292929291" }));
      const hId = await ctx.db.insert("users", makeUser({ clerkId: "holder_retrecall", phone: "+9292929292" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sId as unknown as string, {
          status: "recalled",
          currentHolderId: hId,
          returnDeadline: Date.now() + 7 * 86400000,
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
      return { copyId: cId, locationId: locId };
    });

    const holder = t.withIdentity({ subject: "holder_retrecall" });
    await holder.mutation(api.copies.returnCopy, {
      copyId,
      locationId,
      conditionAtReturn: "good",
      photos: [],
    });

    // Status should remain "recalled", NOT "available"
    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.status).toBe("recalled");
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
  it("sharer can relist a recalled copy as available and clears lending fields", async () => {
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
        makeCopy(bookId, locId, sharerId, {
          status: "recalled",
          currentHolderId: sharerId,
          returnDeadline: Date.now() + 86400000,
          lendingPeriodDays: 21,
          extensionCount: 2,
        }),
      );
    });

    const authed = t.withIdentity({ subject: "user_relist_sharer" });
    await authed.mutation(api.copies.relist, { copyId });

    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.status).toBe("available");
    expect(copy!.currentHolderId).toBeUndefined();
    expect(copy!.returnDeadline).toBeUndefined();
    expect(copy!.lendingPeriodDays).toBeUndefined();
    expect(copy!.extensionCount).toBeUndefined();
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

  it("extend rejects overdue copy", async () => {
    const t = convexTest(schema, modules);

    const { copyId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_ext_overdue", phone: "+8888888881" }));
      const holderId = await ctx.db.insert("users", makeUser({ clerkId: "holder_ext_overdue", phone: "+8888888882" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "checked_out",
          currentHolderId: holderId,
          returnDeadline: Date.now() - 86400000, // overdue by 1 day
          lendingPeriodDays: 21,
          extensionCount: 0,
        }),
      );
      return { copyId: cId };
    });

    const authed = t.withIdentity({ subject: "holder_ext_overdue" });
    await expect(
      authed.mutation(api.copies.extend, { copyId }),
    ).rejects.toThrow("Cannot extend an overdue copy");
  });

  it("extend rejects when active reservation exists for the copy", async () => {
    const t = convexTest(schema, modules);

    const { copyId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_ext_res", phone: "+8888888891" }));
      const holderId = await ctx.db.insert("users", makeUser({ clerkId: "holder_ext_res", phone: "+8888888892" }));
      const reserverId = await ctx.db.insert("users", makeUser({ clerkId: "reserver_ext_res", phone: "+8888888893" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "checked_out",
          currentHolderId: holderId,
          returnDeadline: Date.now() + 86400000,
          lendingPeriodDays: 21,
          extensionCount: 0,
        }),
      );
      // Someone is waiting to reserve this copy
      await ctx.db.insert("reservations", {
        userId: reserverId, copyId: cId, locationId: locId,
        reservedAt: Date.now(), status: "active", expiresAt: Date.now() + 86400000,
      });
      return { copyId: cId };
    });

    const authed = t.withIdentity({ subject: "holder_ext_res" });
    await expect(
      authed.mutation(api.copies.extend, { copyId }),
    ).rejects.toThrow("Cannot extend: there is an active reservation");
  });

  it("extend rejects after max 2 extensions", async () => {
    const t = convexTest(schema, modules);

    const { copyId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_ext_max", phone: "+8888888894" }));
      const holderId = await ctx.db.insert("users", makeUser({ clerkId: "holder_ext_max", phone: "+8888888895" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "checked_out",
          currentHolderId: holderId,
          returnDeadline: Date.now() + 86400000,
          lendingPeriodDays: 21,
          extensionCount: 2, // already at max
        }),
      );
      return { copyId: cId };
    });

    const authed = t.withIdentity({ subject: "holder_ext_max" });
    await expect(
      authed.mutation(api.copies.extend, { copyId }),
    ).rejects.toThrow("Maximum 2 extensions allowed");
  });

  it("relist rejects non-sharer", async () => {
    const t = convexTest(schema, modules);

    const { copyId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_relist", phone: "+7777777771" }));
      await ctx.db.insert("users", makeUser({ clerkId: "random_relist", phone: "+7777777772" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "recalled",
        }),
      );
      return { copyId: cId };
    });

    const authed = t.withIdentity({ subject: "random_relist" });
    await expect(
      authed.mutation(api.copies.relist, { copyId }),
    ).rejects.toThrow("Only the sharer can relist");
  });

  it("pickup rejects wrong location", async () => {
    const t = convexTest(schema, modules);

    const { copyId, wrongLocId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_wrongloc", phone: "+6666666661" }));
      await ctx.db.insert("users", makeUser({ clerkId: "reader_wrongloc", phone: "+6666666662" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const otherLocId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string, {
        name: "Other Location",
        address: "456 Other St",
        contactPhone: "+6666666663",
      }));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string),
      );
      return { copyId: cId, wrongLocId: otherLocId };
    });

    const authed = t.withIdentity({ subject: "reader_wrongloc" });
    await expect(
      authed.mutation(api.copies.pickup, {
        copyId,
        locationId: wrongLocId,
        conditionAtPickup: "good",
        photos: [],
      }),
    ).rejects.toThrow("Copy is not at the specified location");
  });

  it("returnCopy rejects non-holder", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_ret", phone: "+5555555551" }));
      const holderId = await ctx.db.insert("users", makeUser({ clerkId: "holder_ret", phone: "+5555555552" }));
      await ctx.db.insert("users", makeUser({ clerkId: "other_ret", phone: "+5555555553" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "checked_out",
          currentHolderId: holderId,
          returnDeadline: Date.now() + 86400000,
        }),
      );
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "other_ret" });
    await expect(
      authed.mutation(api.copies.returnCopy, {
        copyId,
        locationId,
        conditionAtReturn: "good",
        photos: [],
      }),
    ).rejects.toThrow("You are not the current holder");
  });

  it("pickup rejects when copy is reserved by another user", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId, reservationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_resother", phone: "+4444444441" }));
      const reserverId = await ctx.db.insert("users", makeUser({ clerkId: "reserver_resother", phone: "+4444444442" }));
      await ctx.db.insert("users", makeUser({ clerkId: "intruder_resother", phone: "+4444444443" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "reserved",
        }),
      );
      const resId = await ctx.db.insert("reservations", {
        copyId: cId,
        userId: reserverId,
        locationId: locId,
        reservedAt: Date.now(),
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
        status: "active",
      });
      return { copyId: cId, locationId: locId, reservationId: resId };
    });

    const intruder = t.withIdentity({ subject: "intruder_resother" });
    await expect(
      intruder.mutation(api.copies.pickup, {
        copyId,
        locationId,
        reservationId,
        conditionAtPickup: "good",
        photos: [],
      }),
    ).rejects.toThrow("This copy is reserved by another user");
  });

  it("returnCopy rejects reader note over 1000 characters", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_note", phone: "+3333333331" }));
      const holderId = await ctx.db.insert("users", makeUser({ clerkId: "holder_note", phone: "+3333333332" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "checked_out",
          currentHolderId: holderId,
          returnDeadline: Date.now() + 86400000,
        }),
      );
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "holder_note" });
    await expect(
      authed.mutation(api.copies.returnCopy, {
        copyId,
        locationId,
        conditionAtReturn: "good",
        photos: [],
        readerNote: "A".repeat(1001),
      }),
    ).rejects.toThrow("Reader note must be 1000 characters or less");
  });

  it("pickup rejects when user has 10 active checkouts", async () => {
    const t = convexTest(schema, modules);

    const { newCopyId, locationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_hoard", phone: "+8888888881" }));
      const readerId = await ctx.db.insert("users", makeUser({ clerkId: "reader_hoard", phone: "+8888888882" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      // Create 10 checked-out copies held by the reader
      for (let i = 0; i < 10; i++) {
        await ctx.db.insert(
          "copies",
          makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
            status: "checked_out",
            currentHolderId: readerId,
          }),
        );
      }
      // Create an available copy to try to pick up
      const availCopy = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string),
      );
      return { newCopyId: availCopy, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "reader_hoard" });
    await expect(
      authed.mutation(api.copies.pickup, {
        copyId: newCopyId,
        locationId,
        conditionAtPickup: "good",
        photos: [],
      }),
    ).rejects.toThrow("Maximum 10 books checked out at once");
  });

  it("pickup rejects expired reservation on reserved copy", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId, reservationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_expres", phone: "+6666666661" }));
      const readerId = await ctx.db.insert("users", makeUser({ clerkId: "reader_expres", phone: "+6666666662" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "reserved",
        }),
      );
      const resId = await ctx.db.insert("reservations", {
        copyId: cId,
        userId: readerId,
        locationId: locId,
        reservedAt: Date.now() - 86400000,
        expiresAt: Date.now() - 3600000,
        status: "expired",
      });
      return { copyId: cId, locationId: locId, reservationId: resId };
    });

    const authed = t.withIdentity({ subject: "reader_expres" });
    await expect(
      authed.mutation(api.copies.pickup, {
        copyId,
        locationId,
        conditionAtPickup: "good",
        photos: [],
        reservationId,
      }),
    ).rejects.toThrow("Reservation not found or not active");
  });

  it("pickup rejects reservation that does not match copy", async () => {
    const t = convexTest(schema, modules);

    const { copyId, locationId, wrongReservationId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_wrongres", phone: "+7777777771" }));
      const readerId = await ctx.db.insert("users", makeUser({ clerkId: "reader_wrongres", phone: "+7777777772" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "reserved",
        }),
      );
      // Create a different copy and reservation for it
      const otherCopyId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "reserved",
        }),
      );
      const wrongResId = await ctx.db.insert("reservations", {
        copyId: otherCopyId,
        userId: readerId,
        locationId: locId,
        reservedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
        status: "active",
      });
      return { copyId: cId, locationId: locId, wrongReservationId: wrongResId };
    });

    const authed = t.withIdentity({ subject: "reader_wrongres" });
    await expect(
      authed.mutation(api.copies.pickup, {
        copyId,
        locationId,
        conditionAtPickup: "good",
        photos: [],
        reservationId: wrongReservationId,
      }),
    ).rejects.toThrow("Reservation does not match this copy");
  });

  it("pickup rejects nonexistent location", async () => {
    const t = convexTest(schema, modules);

    const { copyId, fakeLocId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_noloc", phone: "+4444444441" }));
      await ctx.db.insert("users", makeUser({ clerkId: "reader_noloc", phone: "+4444444442" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string),
      );
      // Create and delete a location to get a valid-shaped but nonexistent ID
      const fakeId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      await ctx.db.delete(fakeId);
      return { copyId: cId, fakeLocId: fakeId };
    });

    const authed = t.withIdentity({ subject: "reader_noloc" });
    await expect(
      authed.mutation(api.copies.pickup, {
        copyId,
        locationId: fakeLocId,
        conditionAtPickup: "good",
        photos: [],
      }),
    ).rejects.toThrow("Location not found");
  });

  it("returnCopy rejects nonexistent location", async () => {
    const t = convexTest(schema, modules);

    const { copyId, fakeLocId } = await t.run(async (ctx) => {
      const sharerId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_retloc", phone: "+5555555551" }));
      const holderId = await ctx.db.insert("users", makeUser({ clerkId: "holder_retloc", phone: "+5555555552" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      const cId = await ctx.db.insert(
        "copies",
        makeCopy(bookId as unknown as string, locId as unknown as string, sharerId as unknown as string, {
          status: "checked_out",
          currentHolderId: holderId,
          returnDeadline: Date.now() + 86400000,
        }),
      );
      await ctx.db.insert("journeyEntries", {
        copyId: cId,
        readerId: holderId,
        pickupLocationId: locId,
        pickedUpAt: Date.now() - 86400000,
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      const fakeId = await ctx.db.insert("partnerLocations", makeLocation(sharerId as unknown as string));
      await ctx.db.delete(fakeId);
      return { copyId: cId, fakeLocId: fakeId };
    });

    const authed = t.withIdentity({ subject: "holder_retloc" });
    await expect(
      authed.mutation(api.copies.returnCopy, {
        copyId,
        locationId: fakeLocId,
        conditionAtReturn: "good",
        photos: [],
      }),
    ).rejects.toThrow("Location not found");
  });
});

describe("copies.processOverdue", () => {
  it("applies reputation penalty to holder with overdue copy", async () => {
    const t = convexTest(schema, modules);
    const startingRep = 50;
    const { holderId } = await t.run(async (ctx) => {
      const hId = await ctx.db.insert("users", makeUser({ clerkId: "holder_overdue1", reputationScore: startingRep }));
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_overdue1" }));
      const bId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string));
      await ctx.db.insert("copies", makeCopy(bId as unknown as string, locId as unknown as string, sId as unknown as string, {
        status: "checked_out",
        currentHolderId: hId,
        returnDeadline: Date.now() - 86400000, // 1 day overdue
      }));
      return { holderId: hId };
    });

    await t.mutation(internal.copies.processOverdue, {});

    const user = await t.run(async (ctx) => ctx.db.get(holderId));
    expect(user!.reputationScore).toBe(startingRep - 1); // OVERDUE_DAILY = -1
  });

  it("applies cumulative penalty for multiple overdue copies held by same user", async () => {
    const t = convexTest(schema, modules);
    const startingRep = 50;
    const { holderId } = await t.run(async (ctx) => {
      const hId = await ctx.db.insert("users", makeUser({ clerkId: "holder_overdue2", reputationScore: startingRep }));
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_overdue2" }));
      const bId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string));
      // 3 overdue copies
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("copies", makeCopy(bId as unknown as string, locId as unknown as string, sId as unknown as string, {
          status: "checked_out",
          currentHolderId: hId,
          returnDeadline: Date.now() - 86400000,
        }));
      }
      return { holderId: hId };
    });

    await t.mutation(internal.copies.processOverdue, {});

    const user = await t.run(async (ctx) => ctx.db.get(holderId));
    expect(user!.reputationScore).toBe(startingRep - 3); // -1 per overdue copy
  });

  it("does not penalize copies that are not yet overdue", async () => {
    const t = convexTest(schema, modules);
    const startingRep = 50;
    const { holderId } = await t.run(async (ctx) => {
      const hId = await ctx.db.insert("users", makeUser({ clerkId: "holder_notoverdue", reputationScore: startingRep }));
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_notoverdue" }));
      const bId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string));
      await ctx.db.insert("copies", makeCopy(bId as unknown as string, locId as unknown as string, sId as unknown as string, {
        status: "checked_out",
        currentHolderId: hId,
        returnDeadline: Date.now() + 86400000, // due tomorrow — not overdue
      }));
      return { holderId: hId };
    });

    await t.mutation(internal.copies.processOverdue, {});

    const user = await t.run(async (ctx) => ctx.db.get(holderId));
    expect(user!.reputationScore).toBe(startingRep); // unchanged
  });

  it("skips deleted users gracefully (cron safety)", async () => {
    const t = convexTest(schema, modules);
    const { otherHolderId } = await t.run(async (ctx) => {
      // Deleted holder with overdue copy
      const deletedId = await ctx.db.insert("users", makeUser({ clerkId: "holder_deleted", reputationScore: 50 }));
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_deleted" }));
      const otherHId = await ctx.db.insert("users", makeUser({ clerkId: "holder_other_del", reputationScore: 50, phone: "+7777777777" }));
      const bId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string));
      // Overdue copy held by a user that will be deleted
      await ctx.db.insert("copies", makeCopy(bId as unknown as string, locId as unknown as string, sId as unknown as string, {
        status: "checked_out",
        currentHolderId: deletedId,
        returnDeadline: Date.now() - 86400000,
      }));
      // Overdue copy held by a real user
      await ctx.db.insert("copies", makeCopy(bId as unknown as string, locId as unknown as string, sId as unknown as string, {
        status: "checked_out",
        currentHolderId: otherHId,
        returnDeadline: Date.now() - 86400000,
      }));
      // Delete the first holder
      await ctx.db.delete(deletedId);
      return { otherHolderId: otherHId };
    });

    // Should not throw — deleted user is skipped, other user still penalized
    await t.mutation(internal.copies.processOverdue, {});

    const otherUser = await t.run(async (ctx) => ctx.db.get(otherHolderId));
    expect(otherUser!.reputationScore).toBe(49); // -1 penalty applied
  });

  it("clamps reputation score at 0 (never goes negative)", async () => {
    const t = convexTest(schema, modules);
    const { holderId } = await t.run(async (ctx) => {
      const hId = await ctx.db.insert("users", makeUser({ clerkId: "holder_floor", reputationScore: 0 }));
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_floor" }));
      const bId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string));
      await ctx.db.insert("copies", makeCopy(bId as unknown as string, locId as unknown as string, sId as unknown as string, {
        status: "checked_out",
        currentHolderId: hId,
        returnDeadline: Date.now() - 86400000,
      }));
      return { holderId: hId };
    });

    await t.mutation(internal.copies.processOverdue, {});

    const user = await t.run(async (ctx) => ctx.db.get(holderId));
    expect(user!.reputationScore).toBe(0); // clamped at 0
  });
});

describe("copies.pickup side effects", () => {
  it("decrements location bookCount, increments booksRead, and notifies sharer", async () => {
    const t = convexTest(schema, modules);
    const { copyId, locationId, sharerId, pickupUserId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_fx", name: "Sharer" }));
      const pId = await ctx.db.insert("users", makeUser({ clerkId: "picker_fx", name: "Picker", booksRead: 5 }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string, { currentBookCount: 10 }));
      const cId = await ctx.db.insert("copies", makeCopy(bookId as unknown as string, locId as unknown as string, sId as unknown as string));
      return { copyId: cId, locationId: locId, sharerId: sId, pickupUserId: pId };
    });

    const authed = t.withIdentity({ subject: "picker_fx" });
    await authed.mutation(api.copies.pickup, {
      copyId,
      locationId,
      conditionAtPickup: "good",
      photos: [],
    });

    const { loc, user, notifications, journeyEntries } = await t.run(async (ctx) => ({
      loc: await ctx.db.get(locationId),
      user: await ctx.db.get(pickupUserId),
      notifications: await ctx.db.query("userNotifications")
        .withIndex("by_user_read", (q) => q.eq("userId", sharerId).eq("read", false))
        .collect(),
      journeyEntries: await ctx.db.query("journeyEntries")
        .withIndex("by_copy", (q) => q.eq("copyId", copyId))
        .collect(),
    }));
    expect(loc!.currentBookCount).toBe(9); // decremented from 10
    expect(user!.booksRead).toBe(6); // incremented from 5
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("book_picked_up");
    expect(journeyEntries).toHaveLength(1);
    expect(journeyEntries[0].readerId).toBe(pickupUserId);
  });

  it("pickup of donated book sets no return deadline", async () => {
    const t = convexTest(schema, modules);
    const { copyId, locationId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_donated", name: "Sharer" }));
      const pId = await ctx.db.insert("users", makeUser({ clerkId: "picker_donated", name: "Picker" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string, { currentBookCount: 5 }));
      const cId = await ctx.db.insert("copies", makeCopy(bookId as unknown as string, locId as unknown as string, sId as unknown as string, {
        ownershipType: "donated",
      }));
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "picker_donated" });
    await authed.mutation(api.copies.pickup, {
      copyId, locationId, conditionAtPickup: "good", photos: [],
    });

    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.status).toBe("checked_out");
    expect(copy!.returnDeadline).toBeUndefined(); // donated books have no deadline
  });

  it("pickup caps lending period at 14 days for warning-tier reputation (30-49)", async () => {
    const t = convexTest(schema, modules);
    const { copyId, locationId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_warn", name: "Sharer" }));
      // Reputation 35 = warning tier (30-49)
      const pId = await ctx.db.insert("users", makeUser({ clerkId: "picker_warn", name: "Picker", reputationScore: 35 }));
      const bookId = await ctx.db.insert("books", makeBook({ pageCount: 500 })); // normally would get ~28 days
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string, { currentBookCount: 5 }));
      const cId = await ctx.db.insert("copies", makeCopy(bookId as unknown as string, locId as unknown as string, sId as unknown as string));
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "picker_warn" });
    await authed.mutation(api.copies.pickup, {
      copyId, locationId, conditionAtPickup: "good", photos: [],
    });

    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.status).toBe("checked_out");
    // Lending period should be capped at 14 days (14 * 86400000 ms)
    expect(copy!.lendingPeriodDays).toBeLessThanOrEqual(14);
    const maxDeadline = Date.now() + 14 * 86400000 + 1000; // small buffer
    expect(copy!.returnDeadline).toBeLessThanOrEqual(maxDeadline);
  });

  it("pickup of reserved copy fulfills the reservation", async () => {
    const t = convexTest(schema, modules);
    const { copyId, locationId, reservationId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_res_pu", name: "Sharer" }));
      const pId = await ctx.db.insert("users", makeUser({ clerkId: "picker_res_pu", name: "Picker" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string, { currentBookCount: 5 }));
      const cId = await ctx.db.insert("copies", makeCopy(bookId as unknown as string, locId as unknown as string, sId as unknown as string, {
        status: "reserved",
      }));
      const rId = await ctx.db.insert("reservations", {
        userId: pId, copyId: cId, locationId: locId,
        reservedAt: Date.now(), status: "active", expiresAt: Date.now() + 86400000,
      });
      return { copyId: cId, locationId: locId, reservationId: rId };
    });

    const authed = t.withIdentity({ subject: "picker_res_pu" });
    await authed.mutation(api.copies.pickup, {
      copyId, locationId, reservationId, conditionAtPickup: "good", photos: [],
    });

    const { copy, reservation } = await t.run(async (ctx) => ({
      copy: await ctx.db.get(copyId),
      reservation: await ctx.db.get(reservationId),
    }));
    expect(copy!.status).toBe("checked_out");
    expect(reservation!.status).toBe("fulfilled");
  });

  it("pickup and returnCopy each create a condition report", async () => {
    const t = convexTest(schema, modules);
    const { copyId, locationId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_cr", name: "Sharer" }));
      const pId = await ctx.db.insert("users", makeUser({ clerkId: "picker_cr", name: "Picker" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string, { currentBookCount: 5 }));
      const cId = await ctx.db.insert("copies", makeCopy(bookId as unknown as string, locId as unknown as string, sId as unknown as string));
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "picker_cr" });
    // Pickup creates a pickup_check report
    await authed.mutation(api.copies.pickup, {
      copyId, locationId, conditionAtPickup: "fair", photos: [],
    });

    const pickupReports = await t.run(async (ctx) =>
      ctx.db.query("conditionReports").filter((q) => q.eq(q.field("copyId"), copyId)).collect(),
    );
    expect(pickupReports).toHaveLength(1);
    expect(pickupReports[0].type).toBe("pickup_check");
    expect(pickupReports[0].newCondition).toBe("fair");

    // Return creates a return_check report
    await authed.mutation(api.copies.returnCopy, {
      copyId, locationId, conditionAtReturn: "worn", photos: [],
    });

    const allReports = await t.run(async (ctx) =>
      ctx.db.query("conditionReports").filter((q) => q.eq(q.field("copyId"), copyId)).collect(),
    );
    expect(allReports).toHaveLength(2);
    const returnReport = allReports.find((r) => r.type === "return_check");
    expect(returnReport).toBeDefined();
    expect(returnReport!.newCondition).toBe("worn");
    expect(returnReport!.previousCondition).toBe("good"); // copy.condition at time of return
  });
});

describe("copies.returnCopy side effects", () => {
  it("increments location bookCount, closes journey entry, and notifies sharer", async () => {
    const t = convexTest(schema, modules);
    const { copyId, locationId, sharerId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_ret", name: "Sharer" }));
      const hId = await ctx.db.insert("users", makeUser({ clerkId: "holder_ret", name: "Holder" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string, { currentBookCount: 5 }));
      const cId = await ctx.db.insert("copies", makeCopy(bookId as unknown as string, locId as unknown as string, sId as unknown as string, {
        status: "checked_out",
        currentHolderId: hId,
        returnDeadline: Date.now() + 86400000,
      }));
      await ctx.db.insert("journeyEntries", {
        copyId: cId,
        readerId: hId,
        pickupLocationId: locId,
        pickedUpAt: Date.now() - 86400000,
        conditionAtPickup: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
      return { copyId: cId, locationId: locId, sharerId: sId };
    });

    const authed = t.withIdentity({ subject: "holder_ret" });
    await authed.mutation(api.copies.returnCopy, {
      copyId,
      locationId,
      conditionAtReturn: "good",
      photos: [],
    });

    const { loc, notifications, journeyEntries } = await t.run(async (ctx) => ({
      loc: await ctx.db.get(locationId),
      notifications: await ctx.db.query("userNotifications")
        .withIndex("by_user_read", (q) => q.eq("userId", sharerId).eq("read", false))
        .collect(),
      journeyEntries: await ctx.db.query("journeyEntries")
        .withIndex("by_copy", (q) => q.eq("copyId", copyId))
        .collect(),
    }));
    expect(loc!.currentBookCount).toBe(6); // incremented from 5
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("book_returned");
    expect(journeyEntries).toHaveLength(1);
    expect(journeyEntries[0].returnedAt).toBeDefined();
    expect(journeyEntries[0].conditionAtReturn).toBe("good");
  });

  it("notifies next waitlisted user when copy is returned and becomes available", async () => {
    const t = convexTest(schema, modules);
    const { copyId, locationId, waiterId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_wl", name: "Sharer" }));
      const hId = await ctx.db.insert("users", makeUser({ clerkId: "holder_wl", name: "Holder" }));
      const wId = await ctx.db.insert("users", makeUser({ clerkId: "waiter_wl", name: "Waiter", phone: "+8888888888" }));
      const bookId = await ctx.db.insert("books", makeBook({ title: "Waitlisted Book" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string, { currentBookCount: 0 }));
      const cId = await ctx.db.insert("copies", makeCopy(bookId as unknown as string, locId as unknown as string, sId as unknown as string, {
        status: "checked_out",
        currentHolderId: hId,
        returnDeadline: Date.now() + 86400000,
      }));
      await ctx.db.insert("journeyEntries", {
        copyId: cId, readerId: hId, pickupLocationId: locId,
        pickedUpAt: Date.now() - 86400000, conditionAtPickup: "good",
        pickupPhotos: [], returnPhotos: [],
      });
      // Waiter is waiting for this book
      await ctx.db.insert("waitlist", {
        userId: wId, bookId, status: "waiting", joinedAt: Date.now() - 86400000,
      });
      return { copyId: cId, locationId: locId, waiterId: wId };
    });

    const authed = t.withIdentity({ subject: "holder_wl" });
    await authed.mutation(api.copies.returnCopy, {
      copyId, locationId, conditionAtReturn: "good", photos: [],
    });

    const { waiterNotifs, waitlistEntry } = await t.run(async (ctx) => ({
      waiterNotifs: await ctx.db.query("userNotifications")
        .withIndex("by_user_read", (q) => q.eq("userId", waiterId).eq("read", false))
        .collect(),
      waitlistEntry: await ctx.db.query("waitlist")
        .withIndex("by_user", (q) => q.eq("userId", waiterId))
        .first(),
    }));
    // Waiter should get a waitlist_available notification
    const wlNotif = waiterNotifs.find((n) => n.type === "waitlist_available");
    expect(wlNotif).toBeDefined();
    expect(wlNotif!.message).toContain("Waitlisted Book");
    // Waitlist entry should be updated to "notified"
    expect(waitlistEntry!.status).toBe("notified");
    expect(waitlistEntry!.notifiedCopyId).toBe(copyId);
  });

  it("returnCopy stores reader note in journey entry", async () => {
    const t = convexTest(schema, modules);
    const { copyId, locationId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_note", name: "Sharer" }));
      const hId = await ctx.db.insert("users", makeUser({ clerkId: "holder_note", name: "Holder" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string, { currentBookCount: 5 }));
      const cId = await ctx.db.insert("copies", makeCopy(bookId as unknown as string, locId as unknown as string, sId as unknown as string, {
        status: "checked_out",
        currentHolderId: hId,
        returnDeadline: Date.now() + 86400000,
      }));
      await ctx.db.insert("journeyEntries", {
        copyId: cId, readerId: hId, pickupLocationId: locId,
        pickedUpAt: Date.now() - 86400000, conditionAtPickup: "good",
        pickupPhotos: [], returnPhotos: [],
      });
      return { copyId: cId, locationId: locId };
    });

    const authed = t.withIdentity({ subject: "holder_note" });
    await authed.mutation(api.copies.returnCopy, {
      copyId, locationId, conditionAtReturn: "good", photos: [],
      readerNote: "  Great read, highly recommend!  ",
    });

    const journeyEntry = await t.run(async (ctx) =>
      ctx.db.query("journeyEntries")
        .withIndex("by_copy", (q) => q.eq("copyId", copyId))
        .first(),
    );
    expect(journeyEntry!.readerNote).toBe("Great read, highly recommend!"); // trimmed
  });

  it("returnCopy to different location updates copy currentLocationId and both location counts", async () => {
    const t = convexTest(schema, modules);
    const { copyId, pickupLocId, returnLocId } = await t.run(async (ctx) => {
      const sId = await ctx.db.insert("users", makeUser({ clerkId: "sharer_diffloc", name: "Sharer" }));
      const hId = await ctx.db.insert("users", makeUser({ clerkId: "holder_diffloc", name: "Holder" }));
      const bookId = await ctx.db.insert("books", makeBook());
      const pLocId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string, {
        name: "Pickup Cafe", currentBookCount: 4,
      }));
      const rLocId = await ctx.db.insert("partnerLocations", makeLocation(sId as unknown as string, {
        name: "Return Cafe", contactPhone: "+7777777777", currentBookCount: 2,
      }));
      const cId = await ctx.db.insert("copies", makeCopy(bookId as unknown as string, pLocId as unknown as string, sId as unknown as string, {
        status: "checked_out",
        currentHolderId: hId,
        returnDeadline: Date.now() + 86400000,
      }));
      await ctx.db.insert("journeyEntries", {
        copyId: cId, readerId: hId, pickupLocationId: pLocId,
        pickedUpAt: Date.now() - 86400000, conditionAtPickup: "good",
        pickupPhotos: [], returnPhotos: [],
      });
      return { copyId: cId, pickupLocId: pLocId, returnLocId: rLocId };
    });

    const authed = t.withIdentity({ subject: "holder_diffloc" });
    await authed.mutation(api.copies.returnCopy, {
      copyId, locationId: returnLocId, conditionAtReturn: "good", photos: [],
    });

    const { copy, returnLoc } = await t.run(async (ctx) => ({
      copy: await ctx.db.get(copyId),
      returnLoc: await ctx.db.get(returnLocId),
    }));
    expect(copy!.currentLocationId).toBe(returnLocId); // moved to return location
    expect(returnLoc!.currentBookCount).toBe(3); // incremented from 2
  });
});
