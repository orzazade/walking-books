import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

/** List notifications for the current user (newest first, paginated). */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const limit = Math.max(1, Math.min(args.limit ?? 50, 100));

    const notifications = await ctx.db
      .query("userNotifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    // Batch-fetch unique books to avoid redundant lookups
    const bookIds = [...new Set(
      notifications
        .map((n) => n.relatedBookId)
        .filter((id): id is NonNullable<typeof id> => id !== undefined),
    )];
    const books = await Promise.all(bookIds.map((id) => ctx.db.get(id)));
    const bookMap = new Map(
      bookIds.map((id, i) => [id, books[i]] as const),
    );

    return notifications.map((n) => ({
      ...n,
      bookTitle: n.relatedBookId
        ? bookMap.get(n.relatedBookId)?.title
        : undefined,
    }));
  },
});

/** Count of unread notifications for badge display. */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return 0;

    const unread = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("read", false),
      )
      .collect();

    return unread.length;
  },
});

/** Mark a single notification as read. */
export const markRead = mutation({
  args: { notificationId: v.id("userNotifications") },
  handler: async (ctx, args) => {
    const [user, notification] = await Promise.all([
      requireCurrentUser(ctx),
      ctx.db.get(args.notificationId),
    ]);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(args.notificationId, { read: true });
  },
});

/** Mark all notifications as read. */
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);

    const unread = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("read", false),
      )
      .collect();

    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { read: true })));
  },
});

/** Delete a single notification. */
export const remove = mutation({
  args: { notificationId: v.id("userNotifications") },
  handler: async (ctx, args) => {
    const [user, notification] = await Promise.all([
      requireCurrentUser(ctx),
      ctx.db.get(args.notificationId),
    ]);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(args.notificationId);
  },
});
