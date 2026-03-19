import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

/** Post a public request for a book the community doesn't have yet. */
export const create = mutation({
  args: {
    title: v.string(),
    author: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const title = args.title.trim();
    if (title.length === 0) throw new Error("Title is required");
    if (title.length > 300) throw new Error("Title must be 300 characters or less");

    let author: string | undefined;
    if (args.author !== undefined) {
      author = args.author.trim();
      if (author.length === 0) author = undefined;
      else if (author.length > 200)
        throw new Error("Author must be 200 characters or less");
    }

    let note: string | undefined;
    if (args.note !== undefined) {
      note = args.note.trim();
      if (note.length === 0) note = undefined;
      else if (note.length > 500)
        throw new Error("Note must be 500 characters or less");
    }

    // Prevent duplicate open requests from same user for same title
    const existing = await ctx.db
      .query("bookRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "open"),
          q.eq(q.field("title"), title),
        ),
      )
      .first();
    if (existing) throw new Error("You already have an open request for this book");

    return await ctx.db.insert("bookRequests", {
      userId: user._id,
      title,
      author,
      note,
      status: "open",
      createdAt: Date.now(),
    });
  },
});

/** Cancel your own open request. */
export const cancel = mutation({
  args: { requestId: v.id("bookRequests") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");
    if (request.userId !== user._id) throw new Error("Not your request");
    if (request.status !== "open") throw new Error("Request is not open");

    await ctx.db.patch(args.requestId, { status: "cancelled" });
  },
});

/** Mark a request as fulfilled — the fulfiller shared or pointed to the book. */
export const fulfill = mutation({
  args: { requestId: v.id("bookRequests") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");
    if (request.status !== "open") throw new Error("Request is not open");

    await ctx.db.patch(args.requestId, {
      status: "fulfilled",
      fulfilledBy: user._id,
      fulfilledAt: Date.now(),
    });
  },
});

/** Browse all open requests — the community board. */
export const active = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 100));

    const requests = await ctx.db
      .query("bookRequests")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(limit);

    return Promise.all(
      requests.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return {
          ...r,
          requesterName: user?.name ?? "Unknown",
        };
      }),
    );
  },
});

/** Get the current user's requests (all statuses). */
export const myRequests = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const requests = await ctx.db
      .query("bookRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return requests;
  },
});
