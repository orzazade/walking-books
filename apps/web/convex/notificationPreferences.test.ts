import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_notifpref1",
    phone: "+1234567890",
    name: "Pref User",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

const ALL_ENABLED = {
  reservation_confirmed: true,
  reservation_expired: true,
  book_picked_up: true,
  book_returned: true,
  book_recalled: true,
  waitlist_notified: true,
  waitlist_available: true,
  wishlist_available: true,
  reputation_milestone: true,
  achievement_unlocked: true,
  book_request_fulfilled: true,
};

describe("notificationPreferences", () => {
  it("get returns all-true defaults when no preferences saved", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_notifpref1" });
    const prefs = await authed.query(api.notificationPreferences.get, {});
    expect(prefs).toEqual(ALL_ENABLED);
  });

  it("get returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const prefs = await t.query(api.notificationPreferences.get, {});
    expect(prefs).toBeNull();
  });

  it("update creates preferences on first save", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_notifpref1" });
    await authed.mutation(api.notificationPreferences.update, {
      ...ALL_ENABLED,
      book_picked_up: false,
      achievement_unlocked: false,
    });

    const prefs = await authed.query(api.notificationPreferences.get, {});
    expect(prefs).not.toBeNull();
    expect(prefs!.book_picked_up).toBe(false);
    expect(prefs!.achievement_unlocked).toBe(false);
    expect(prefs!.reservation_confirmed).toBe(true);
  });

  it("update patches existing preferences", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_notifpref1" });

    // First save
    await authed.mutation(api.notificationPreferences.update, {
      ...ALL_ENABLED,
      book_returned: false,
    });

    // Second save — change different field
    await authed.mutation(api.notificationPreferences.update, {
      ...ALL_ENABLED,
      book_returned: false,
      waitlist_notified: false,
    });

    const prefs = await authed.query(api.notificationPreferences.get, {});
    expect(prefs!.book_returned).toBe(false);
    expect(prefs!.waitlist_notified).toBe(false);
    expect(prefs!.book_picked_up).toBe(true);
  });

  it("update rejects unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.notificationPreferences.update, ALL_ENABLED),
    ).rejects.toThrow("Not authenticated");
  });

  it("createNotification respects disabled preference", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_notifpref1" });

    // Disable book_picked_up notifications
    await authed.mutation(api.notificationPreferences.update, {
      ...ALL_ENABLED,
      book_picked_up: false,
    });

    // Insert notification via the helper (simulate by calling createNotification logic)
    await t.run(async (ctx) => {
      const { createNotification } = await import("./lib/notifications");
      await createNotification(ctx, {
        userId,
        type: "book_picked_up",
        title: "Your book was picked up",
        message: "Someone picked up your book",
      });
    });

    // Should NOT have created the notification
    const list = await authed.query(api.userNotifications.list, {});
    expect(list).toHaveLength(0);
  });

  it("createNotification allows enabled preference", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_notifpref1" });

    // Disable only book_returned, keep book_picked_up enabled
    await authed.mutation(api.notificationPreferences.update, {
      ...ALL_ENABLED,
      book_returned: false,
    });

    // Send a book_picked_up notification (enabled)
    await t.run(async (ctx) => {
      const { createNotification } = await import("./lib/notifications");
      await createNotification(ctx, {
        userId,
        type: "book_picked_up",
        title: "Your book was picked up",
        message: "Someone picked up your book",
      });
    });

    const list = await authed.query(api.userNotifications.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe("book_picked_up");
  });

  it("createNotification defaults to sending when no preferences saved", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser());
    });

    // No preferences saved — should send notification
    await t.run(async (ctx) => {
      const { createNotification } = await import("./lib/notifications");
      await createNotification(ctx, {
        userId,
        type: "achievement_unlocked",
        title: "Achievement!",
        message: "You earned an achievement",
      });
    });

    const authed = t.withIdentity({ subject: "user_notifpref1" });
    const list = await authed.query(api.userNotifications.list, {});
    expect(list).toHaveLength(1);
  });

  it("preferences are per-user isolated", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      await ctx.db.insert("users", makeUser({ clerkId: "user_notifpref2", phone: "+9999999999", name: "Other" }));
    });

    const user1 = t.withIdentity({ subject: "user_notifpref1" });
    const user2 = t.withIdentity({ subject: "user_notifpref2" });

    // User 1 disables achievement notifications
    await user1.mutation(api.notificationPreferences.update, {
      ...ALL_ENABLED,
      achievement_unlocked: false,
    });

    // User 2 should still have defaults (all enabled)
    const prefs2 = await user2.query(api.notificationPreferences.get, {});
    expect(prefs2!.achievement_unlocked).toBe(true);

    const prefs1 = await user1.query(api.notificationPreferences.get, {});
    expect(prefs1!.achievement_unlocked).toBe(false);
  });
});
