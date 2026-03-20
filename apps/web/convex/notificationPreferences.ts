import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";
import { NotificationType } from "./lib/validators";

const NOTIFICATION_TYPE_KEYS: NotificationType[] = [
  "reservation_confirmed",
  "reservation_expired",
  "book_picked_up",
  "book_returned",
  "book_recalled",
  "waitlist_notified",
  "waitlist_available",
  "wishlist_available",
  "reputation_milestone",
  "achievement_unlocked",
  "book_request_fulfilled",
  "transfer_accepted",
];

/** Get notification preferences for the current user. All default to true. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!prefs) {
      // Return defaults — all enabled
      const defaults: Record<NotificationType, boolean> = {} as Record<NotificationType, boolean>;
      for (const key of NOTIFICATION_TYPE_KEYS) {
        defaults[key] = true;
      }
      return defaults;
    }

    const result: Record<NotificationType, boolean> = {} as Record<NotificationType, boolean>;
    for (const key of NOTIFICATION_TYPE_KEYS) {
      result[key] = prefs[key];
    }
    return result;
  },
});

/** Update notification preferences for the current user. Creates row on first save. */
export const update = mutation({
  args: {
    reservation_confirmed: v.boolean(),
    reservation_expired: v.boolean(),
    book_picked_up: v.boolean(),
    book_returned: v.boolean(),
    book_recalled: v.boolean(),
    waitlist_notified: v.boolean(),
    waitlist_available: v.boolean(),
    wishlist_available: v.boolean(),
    reputation_milestone: v.boolean(),
    achievement_unlocked: v.boolean(),
    book_request_fulfilled: v.boolean(),
    transfer_accepted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("notificationPreferences", {
        userId: user._id,
        ...args,
      });
    }
  },
});
