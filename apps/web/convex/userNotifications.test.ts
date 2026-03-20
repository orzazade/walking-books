import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_notif1",
    phone: "+1234567890",
    name: "Notif User",
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

describe("userNotifications", () => {
  it("list returns empty for new user", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_notif1" });
    const result = await authed.query(api.userNotifications.list, {});
    expect(result).toEqual([]);
  });

  it("list returns empty for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.userNotifications.list, {});
    expect(result).toEqual([]);
  });

  it("unreadCount returns 0 for new user", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_notif1" });
    const count = await authed.query(api.userNotifications.unreadCount, {});
    expect(count).toBe(0);
  });

  it("unreadCount returns 0 for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const count = await t.query(api.userNotifications.unreadCount, {});
    expect(count).toBe(0);
  });

  it("notifications are created and listed with book title enrichment", async () => {
    const t = convexTest(schema, modules);

    const { userId, bookId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const bid = await ctx.db.insert("books", makeBook({ title: "Great Novel" }));
      return { userId: uid, bookId: bid };
    });

    // Insert a notification directly
    await t.run(async (ctx) => {
      await ctx.db.insert("userNotifications", {
        userId,
        type: "book_picked_up",
        title: "Your book was picked up",
        message: "Someone picked up Great Novel",
        relatedBookId: bookId,
        read: false,
        createdAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: "user_notif1" });
    const list = await authed.query(api.userNotifications.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Your book was picked up");
    expect(list[0].bookTitle).toBe("Great Novel");
    expect(list[0].read).toBe(false);
  });

  it("markRead marks a notification as read", async () => {
    const t = convexTest(schema, modules);

    const notifId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("userNotifications", {
        userId,
        type: "reservation_confirmed",
        title: "Reservation confirmed",
        message: "Your reservation is ready",
        read: false,
        createdAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: "user_notif1" });

    await authed.mutation(api.userNotifications.markRead, { notificationId: notifId });

    const list = await authed.query(api.userNotifications.list, {});
    expect(list[0].read).toBe(true);
  });

  it("markRead rejects unauthorized user", async () => {
    const t = convexTest(schema, modules);

    const notifId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      await ctx.db.insert("users", makeUser({ clerkId: "user_notif2", phone: "+9999999999", name: "Other" }));
      return await ctx.db.insert("userNotifications", {
        userId,
        type: "reservation_confirmed",
        title: "Test",
        message: "Test",
        read: false,
        createdAt: Date.now(),
      });
    });

    const otherUser = t.withIdentity({ subject: "user_notif2" });
    await expect(
      otherUser.mutation(api.userNotifications.markRead, { notificationId: notifId }),
    ).rejects.toThrow("Not authorized");
  });

  it("markAllRead marks all unread notifications", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const now = Date.now();
      await ctx.db.insert("userNotifications", {
        userId,
        type: "book_picked_up",
        title: "Notif 1",
        message: "Msg 1",
        read: false,
        createdAt: now,
      });
      await ctx.db.insert("userNotifications", {
        userId,
        type: "book_returned",
        title: "Notif 2",
        message: "Msg 2",
        read: false,
        createdAt: now + 1,
      });
    });

    const authed = t.withIdentity({ subject: "user_notif1" });

    let count = await authed.query(api.userNotifications.unreadCount, {});
    expect(count).toBe(2);

    await authed.mutation(api.userNotifications.markAllRead, {});

    count = await authed.query(api.userNotifications.unreadCount, {});
    expect(count).toBe(0);
  });

  it("remove deletes a notification", async () => {
    const t = convexTest(schema, modules);

    const notifId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("userNotifications", {
        userId,
        type: "book_recalled",
        title: "Book recalled",
        message: "Return it soon",
        read: false,
        createdAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: "user_notif1" });
    await authed.mutation(api.userNotifications.remove, { notificationId: notifId });

    const list = await authed.query(api.userNotifications.list, {});
    expect(list).toHaveLength(0);
  });

  it("remove rejects deleting another user's notification", async () => {
    const t = convexTest(schema, modules);

    const notifId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      await ctx.db.insert("users", makeUser({ clerkId: "user_notif2", phone: "+9999999999", name: "Other" }));
      return await ctx.db.insert("userNotifications", {
        userId,
        type: "book_recalled",
        title: "Test",
        message: "Test",
        read: false,
        createdAt: Date.now(),
      });
    });

    const otherUser = t.withIdentity({ subject: "user_notif2" });
    await expect(
      otherUser.mutation(api.userNotifications.remove, { notificationId: notifId }),
    ).rejects.toThrow("Not authorized");
  });

  it("list returns relatedBookId and relatedLocationId for deep linking", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bookId = await ctx.db.insert("books", makeBook({ title: "Linked Book" }));
      const locId = await ctx.db.insert("partnerLocations", {
        name: "Corner Cafe",
        address: "456 Oak Ave",
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
      await ctx.db.insert("userNotifications", {
        userId,
        type: "book_picked_up",
        title: "Book picked up",
        message: "At Corner Cafe",
        relatedBookId: bookId,
        relatedLocationId: locId,
        read: false,
        createdAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: "user_notif1" });
    const list = await authed.query(api.userNotifications.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].relatedBookId).toBeDefined();
    expect(list[0].relatedLocationId).toBeDefined();
    expect(list[0].bookTitle).toBe("Linked Book");
  });

  it("list respects limit parameter", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("userNotifications", {
          userId,
          type: "book_picked_up",
          title: `Notif ${i}`,
          message: `Message ${i}`,
          read: false,
          createdAt: now + i,
        });
      }
    });

    const authed = t.withIdentity({ subject: "user_notif1" });
    const list = await authed.query(api.userNotifications.list, { limit: 3 });
    expect(list).toHaveLength(3);
  });

  it("remove rejects nonexistent notification", async () => {
    const t = convexTest(schema, modules);

    const fakeNotifId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const nId = await ctx.db.insert("userNotifications", {
        userId,
        type: "book_picked_up",
        title: "Test",
        message: "Test message",
        read: false,
        createdAt: Date.now(),
      });
      await ctx.db.delete(nId);
      return nId;
    });

    const authed = t.withIdentity({ subject: "user_notif1" });

    await expect(
      authed.mutation(api.userNotifications.remove, { notificationId: fakeNotifId }),
    ).rejects.toThrow("Notification not found");
  });

  it("markRead rejects nonexistent notification", async () => {
    const t = convexTest(schema, modules);

    const fakeNotifId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const nId = await ctx.db.insert("userNotifications", {
        userId,
        type: "book_picked_up",
        title: "Test",
        message: "Test message",
        read: false,
        createdAt: Date.now(),
      });
      await ctx.db.delete(nId);
      return nId;
    });

    const authed = t.withIdentity({ subject: "user_notif1" });

    await expect(
      authed.mutation(api.userNotifications.markRead, { notificationId: fakeNotifId }),
    ).rejects.toThrow("Notification not found");
  });

  it("markAllRead only marks unread notifications, preserves already-read ones", async () => {
    const t = convexTest(schema, modules);
    const { readNotifId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const alreadyRead = await ctx.db.insert("userNotifications", {
        userId,
        type: "reservation_expired",
        title: "Old",
        message: "Already read",
        read: true,
        createdAt: Date.now() - 86400000,
      });
      await ctx.db.insert("userNotifications", {
        userId,
        type: "reservation_expired",
        title: "New1",
        message: "Unread 1",
        read: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("userNotifications", {
        userId,
        type: "reservation_expired",
        title: "New2",
        message: "Unread 2",
        read: false,
        createdAt: Date.now(),
      });
      return { readNotifId: alreadyRead };
    });

    const authed = t.withIdentity({ subject: "user_notif1" });
    await authed.mutation(api.userNotifications.markAllRead, {});

    const { allNotifs, unreadCount } = await t.run(async (ctx) => {
      const all = await ctx.db.query("userNotifications").collect();
      return {
        allNotifs: all,
        unreadCount: all.filter((n) => !n.read).length,
      };
    });
    expect(allNotifs).toHaveLength(3); // all 3 still exist
    expect(unreadCount).toBe(0); // all now read
    // The already-read notification is still intact
    const readNotif = allNotifs.find((n) => n._id === readNotifId);
    expect(readNotif!.read).toBe(true);
  });

  it("markAllRead does not affect another user's notifications", async () => {
    const t = convexTest(schema, modules);
    const { otherUserId } = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      const otherId = await ctx.db.insert("users", makeUser({ clerkId: "user_notif2", phone: "+9999999999" }));
      // Create unread notification for the other user
      await ctx.db.insert("userNotifications", {
        userId: otherId,
        type: "reservation_expired",
        title: "Other's notif",
        message: "Should stay unread",
        read: false,
        createdAt: Date.now(),
      });
      return { otherUserId: otherId };
    });

    const authed = t.withIdentity({ subject: "user_notif1" });
    await authed.mutation(api.userNotifications.markAllRead, {});

    // Other user's notification should still be unread
    const otherNotifs = await t.run(async (ctx) =>
      ctx.db.query("userNotifications")
        .withIndex("by_user_read", (q) => q.eq("userId", otherUserId).eq("read", false))
        .collect(),
    );
    expect(otherNotifs).toHaveLength(1);
    expect(otherNotifs[0].title).toBe("Other's notif");
  });
});
