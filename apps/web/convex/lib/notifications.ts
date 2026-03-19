import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { NotificationType } from "./validators";

/** Create an in-app notification for a user, respecting their preferences. */
export async function createNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    type: NotificationType;
    title: string;
    message: string;
    relatedBookId?: Id<"books">;
    relatedCopyId?: Id<"copies">;
    relatedLocationId?: Id<"partnerLocations">;
  },
): Promise<void> {
  // Check user's notification preferences
  const prefs = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .unique();

  // If preferences exist and this type is disabled, skip
  if (prefs && prefs[args.type] === false) {
    return;
  }

  await ctx.db.insert("userNotifications", {
    userId: args.userId,
    type: args.type,
    title: args.title,
    message: args.message,
    relatedBookId: args.relatedBookId,
    relatedCopyId: args.relatedCopyId,
    relatedLocationId: args.relatedLocationId,
    read: false,
    createdAt: Date.now(),
  });
}
