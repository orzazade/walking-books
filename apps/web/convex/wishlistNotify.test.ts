import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: { clerkId: string; name: string; phone: string }) {
  return {
    ...overrides,
    roles: ["reader"] as string[],
    status: "active" as const,
    reputationScore: 100,
    booksShared: 5,
    booksRead: 5,
    favoriteGenres: [],
  };
}

function makeBook(title: string) {
  return {
    title,
    author: "Test Author",
    coverImage: "https://example.com/cover.jpg",
    description: "A test book",
    categories: ["fiction"],
    pageCount: 200,
    language: "English",
    avgRating: 0,
    reviewCount: 0,
  };
}

function makeLocation(managedByUserId: Id<"users">) {
  return {
    name: "Test Cafe",
    address: "123 Main St",
    lat: 40.7,
    lng: -74.0,
    contactPhone: "+1000000000",
    operatingHours: {},
    photos: [],
    shelfCapacity: 50,
    currentBookCount: 5,
    managedByUserId,
    staffUserIds: [],
    avgRating: 0,
    reviewCount: 0,
  };
}

describe("wishlist availability notifications", () => {
  it("notifies wishlisters when a book copy is returned and becomes available", async () => {
    const t = convexTest(schema, modules);

    // Set up: sharer, reader (who returns), and wisher (who wishlisted)
    const { sharerId, readerId, wisherId, bookId, copyId, locationId } =
      await t.run(async (ctx) => {
        const sid = await ctx.db.insert(
          "users",
          makeUser({ clerkId: "sharer1", name: "Sharer", phone: "+1111111111" }),
        );
        const rid = await ctx.db.insert(
          "users",
          makeUser({ clerkId: "reader1", name: "Reader", phone: "+2222222222" }),
        );
        const wid = await ctx.db.insert(
          "users",
          makeUser({ clerkId: "wisher1", name: "Wisher", phone: "+3333333333" }),
        );
        const locId = await ctx.db.insert("partnerLocations", makeLocation(sid));
        const bid = await ctx.db.insert("books", makeBook("Wishlisted Novel"));
        const cid = await ctx.db.insert("copies", {
          bookId: bid,
          status: "checked_out",
          condition: "good",
          ownershipType: "lent",
          originalSharerId: sid,
          currentHolderId: rid,
          currentLocationId: locId,
          returnDeadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
          lendingPeriodDays: 21,
          qrCodeUrl: "",
        });
        // Create journey entry for returnCopy
        await ctx.db.insert("journeyEntries", {
          copyId: cid,
          readerId: rid,
          pickupLocationId: locId,
          pickedUpAt: Date.now() - 86400000,
          conditionAtPickup: "good",
          pickupPhotos: [],
          returnPhotos: [],
        });
        // Wisher wishlists the book
        await ctx.db.insert("wishlist", {
          userId: wid,
          bookId: bid,
          addedAt: Date.now(),
        });
        return {
          sharerId: sid,
          readerId: rid,
          wisherId: wid,
          bookId: bid,
          copyId: cid,
          locationId: locId,
        };
      });

    // Reader returns the book
    const readerAuth = t.withIdentity({ subject: "reader1" });
    await readerAuth.mutation(api.copies.returnCopy, {
      copyId,
      locationId,
      conditionAtReturn: "good",
      photos: ["photo1.jpg"],
    });

    // Wisher should have a wishlist_available notification
    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("userNotifications")
        .withIndex("by_user", (q) => q.eq("userId", wisherId))
        .collect();
    });

    const wishlistNotif = notifications.find(
      (n) => n.type === "wishlist_available",
    );
    expect(wishlistNotif).toBeDefined();
    expect(wishlistNotif!.title).toBe("A wishlisted book is available!");
    expect(wishlistNotif!.message).toContain("Wishlisted Novel");
    expect(wishlistNotif!.message).toContain("Test Cafe");
    expect(wishlistNotif!.relatedBookId).toBe(bookId);
    expect(wishlistNotif!.relatedCopyId).toBe(copyId);
  });

  it("does not notify the user who returned the book even if they wishlisted it", async () => {
    const t = convexTest(schema, modules);

    const { readerId, bookId, copyId, locationId } = await t.run(
      async (ctx) => {
        const sid = await ctx.db.insert(
          "users",
          makeUser({ clerkId: "sharer2", name: "Sharer", phone: "+4444444444" }),
        );
        const rid = await ctx.db.insert(
          "users",
          makeUser({ clerkId: "reader2", name: "Reader", phone: "+5555555555" }),
        );
        const locId = await ctx.db.insert("partnerLocations", makeLocation(sid));
        const bid = await ctx.db.insert("books", makeBook("Self Wishlisted"));
        const cid = await ctx.db.insert("copies", {
          bookId: bid,
          status: "checked_out",
          condition: "good",
          ownershipType: "lent",
          originalSharerId: sid,
          currentHolderId: rid,
          currentLocationId: locId,
          returnDeadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
          lendingPeriodDays: 21,
          qrCodeUrl: "",
        });
        await ctx.db.insert("journeyEntries", {
          copyId: cid,
          readerId: rid,
          pickupLocationId: locId,
          pickedUpAt: Date.now() - 86400000,
          conditionAtPickup: "good",
          pickupPhotos: [],
          returnPhotos: [],
        });
        // Reader also wishlisted the book (e.g., before picking it up)
        await ctx.db.insert("wishlist", {
          userId: rid,
          bookId: bid,
          addedAt: Date.now(),
        });
        return { readerId: rid, bookId: bid, copyId: cid, locationId: locId };
      },
    );

    const readerAuth = t.withIdentity({ subject: "reader2" });
    await readerAuth.mutation(api.copies.returnCopy, {
      copyId,
      locationId,
      conditionAtReturn: "good",
      photos: ["photo1.jpg"],
    });

    // Reader should NOT get a wishlist_available notification for their own return
    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("userNotifications")
        .withIndex("by_user", (q) => q.eq("userId", readerId))
        .collect();
    });

    const wishlistNotif = notifications.find(
      (n) => n.type === "wishlist_available",
    );
    expect(wishlistNotif).toBeUndefined();
  });

  it("respects notification preferences — disabled wishlist_available skips notification", async () => {
    const t = convexTest(schema, modules);

    const { wisherId, bookId, copyId, locationId } = await t.run(
      async (ctx) => {
        const sid = await ctx.db.insert(
          "users",
          makeUser({ clerkId: "sharer3", name: "Sharer", phone: "+6666666666" }),
        );
        const rid = await ctx.db.insert(
          "users",
          makeUser({ clerkId: "reader3", name: "Reader", phone: "+7777777777" }),
        );
        const wid = await ctx.db.insert(
          "users",
          makeUser({ clerkId: "wisher3", name: "Wisher", phone: "+8888888888" }),
        );
        const locId = await ctx.db.insert("partnerLocations", makeLocation(sid));
        const bid = await ctx.db.insert("books", makeBook("Muted Book"));
        const cid = await ctx.db.insert("copies", {
          bookId: bid,
          status: "checked_out",
          condition: "good",
          ownershipType: "lent",
          originalSharerId: sid,
          currentHolderId: rid,
          currentLocationId: locId,
          returnDeadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
          lendingPeriodDays: 21,
          qrCodeUrl: "",
        });
        await ctx.db.insert("journeyEntries", {
          copyId: cid,
          readerId: rid,
          pickupLocationId: locId,
          pickedUpAt: Date.now() - 86400000,
          conditionAtPickup: "good",
          pickupPhotos: [],
          returnPhotos: [],
        });
        await ctx.db.insert("wishlist", {
          userId: wid,
          bookId: bid,
          addedAt: Date.now(),
        });
        // Disable wishlist_available notifications
        await ctx.db.insert("notificationPreferences", {
          userId: wid,
          reservation_confirmed: true,
          reservation_expired: true,
          book_picked_up: true,
          book_returned: true,
          book_recalled: true,
          waitlist_notified: true,
          waitlist_available: true,
          wishlist_available: false,
          reputation_milestone: true,
          achievement_unlocked: true,
          book_request_fulfilled: true,
          transfer_accepted: true,
        });
        return { wisherId: wid, bookId: bid, copyId: cid, locationId: locId };
      },
    );

    const readerAuth = t.withIdentity({ subject: "reader3" });
    await readerAuth.mutation(api.copies.returnCopy, {
      copyId,
      locationId,
      conditionAtReturn: "good",
      photos: ["photo1.jpg"],
    });

    // Wisher should NOT get notification because they disabled it
    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("userNotifications")
        .withIndex("by_user", (q) => q.eq("userId", wisherId))
        .collect();
    });

    const wishlistNotif = notifications.find(
      (n) => n.type === "wishlist_available",
    );
    expect(wishlistNotif).toBeUndefined();
  });
});
