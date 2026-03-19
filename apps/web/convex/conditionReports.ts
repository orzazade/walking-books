import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { conditionValidator, reportTypeValidator, validatePhotos } from "./lib/validators";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

export const byLocation = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    // Get all copies at this location
    const copies = await ctx.db
      .query("copies")
      .withIndex("by_location", (q) => q.eq("currentLocationId", args.locationId))
      .collect();

    // Get all condition reports for these copies
    const reportArrays = await Promise.all(
      copies.map((copy) =>
        ctx.db
          .query("conditionReports")
          .withIndex("by_copy", (q) => q.eq("copyId", copy._id))
          .collect(),
      ),
    );
    return reportArrays.flat().sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const admin = await getCurrentUser(ctx);
    if (!admin || !admin.roles.includes("admin")) return [];
    return await ctx.db.query("conditionReports").collect();
  },
});

export const create = mutation({
  args: {
    copyId: v.id("copies"),
    type: reportTypeValidator,
    photos: v.array(v.string()),
    description: v.string(),
    previousCondition: conditionValidator,
    newCondition: conditionValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    validatePhotos(args.photos);

    const trimmed = args.description.trim();
    if (!trimmed) throw new Error("Description is required");
    if (trimmed.length > 2000)
      throw new Error("Description must be 2000 characters or less");

    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");

    const reportId = await ctx.db.insert("conditionReports", {
      copyId: args.copyId,
      reportedByUserId: user._id,
      type: args.type,
      photos: args.photos,
      description: trimmed,
      previousCondition: copy.condition,
      newCondition: args.newCondition,
      createdAt: Date.now(),
    });

    // If damage report, update copy condition
    if (args.type === "damage_report") {
      await ctx.db.patch(args.copyId, {
        condition: args.newCondition,
      });
    }

    return reportId;
  },
});
