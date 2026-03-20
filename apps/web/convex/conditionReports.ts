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

export const byCopy = query({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conditionReports")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .collect()
      .then((reports) => reports.sort((a, b) => b.createdAt - a.createdAt));
  },
});

export const create = mutation({
  args: {
    copyId: v.id("copies"),
    type: reportTypeValidator,
    photos: v.array(v.string()),
    description: v.string(),
    newCondition: conditionValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    // Per-user limit on condition reports
    const reportCount = await ctx.db
      .query("conditionReports")
      .filter((q) => q.eq(q.field("reportedByUserId"), user._id))
      .collect()
      .then((r) => r.length);
    if (reportCount >= 100)
      throw new Error("Maximum 100 condition reports allowed per user");

    validatePhotos(args.photos);

    const trimmed = args.description.trim();
    if (!trimmed) throw new Error("Description is required");
    if (trimmed.length > 2000)
      throw new Error("Description must be 2000 characters or less");

    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");

    // Only the holder, sharer, or location staff can report condition
    const isHolder = copy.currentHolderId === user._id;
    const isSharer = copy.originalSharerId === user._id;
    let isLocationStaff = false;
    if (copy.currentLocationId) {
      const location = await ctx.db.get(copy.currentLocationId);
      if (location) {
        isLocationStaff =
          location.managedByUserId === user._id ||
          location.staffUserIds.includes(user._id);
      }
    }
    if (!isHolder && !isSharer && !isLocationStaff)
      throw new Error("Only the holder, sharer, or location staff can report condition");

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
