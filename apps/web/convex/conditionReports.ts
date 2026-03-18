import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { conditionValidator } from "./lib/validators";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";

export const byCopy = query({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conditionReports")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .collect();
  },
});

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
    const user = await getCurrentUser(ctx);
    if (!user || !user.roles.includes("admin")) return [];
    return await ctx.db.query("conditionReports").collect();
  },
});

export const create = mutation({
  args: {
    copyId: v.id("copies"),
    type: v.union(
      v.literal("pickup_check"),
      v.literal("return_check"),
      v.literal("damage_report"),
    ),
    photos: v.array(v.string()),
    description: v.string(),
    previousCondition: conditionValidator,
    newCondition: conditionValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const reportId = await ctx.db.insert("conditionReports", {
      copyId: args.copyId,
      reportedByUserId: user._id,
      reportedByPartnerId: undefined,
      type: args.type,
      photos: args.photos,
      description: args.description,
      previousCondition: args.previousCondition,
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
