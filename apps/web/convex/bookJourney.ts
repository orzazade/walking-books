import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { DAY_MS } from "./lib/lending";

/**
 * Book Journey — trace the complete travel history of a book copy.
 *
 * forCopy: chronological list of stops (pickup → return) with reader names,
 *          location names, condition changes, and notes.
 * summary: aggregate stats — total readers, unique locations, total days lent,
 *          current location and holder.
 */

type JourneyStop = {
  readerId: Id<"users">;
  readerName: string;
  pickupLocation: { _id: Id<"partnerLocations">; name: string };
  returnLocation: { _id: Id<"partnerLocations">; name: string } | null;
  pickedUpAt: number;
  returnedAt: number | null;
  daysHeld: number | null;
  conditionAtPickup: string;
  conditionAtReturn: string | null;
  readerNote: string | null;
};

export const forCopy = query({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args): Promise<JourneyStop[]> => {
    const entries = await ctx.db
      .query("journeyEntries")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .collect();

    if (entries.length === 0) return [];

    // Collect unique IDs for batch lookup
    const readerIds = new Set<Id<"users">>();
    const locationIds = new Set<Id<"partnerLocations">>();
    for (const entry of entries) {
      readerIds.add(entry.readerId);
      locationIds.add(entry.pickupLocationId);
      if (entry.dropoffLocationId) locationIds.add(entry.dropoffLocationId);
    }

    // Batch-fetch readers and locations
    const [readers, locations] = await Promise.all([
      Promise.all([...readerIds].map((id) => ctx.db.get(id))),
      Promise.all([...locationIds].map((id) => ctx.db.get(id))),
    ]);

    const readerMap = new Map<Id<"users">, Doc<"users">>();
    for (const r of readers) {
      if (r) readerMap.set(r._id, r);
    }
    const locationMap = new Map<Id<"partnerLocations">, Doc<"partnerLocations">>();
    for (const l of locations) {
      if (l) locationMap.set(l._id, l);
    }

    // Sort chronologically (oldest first)
    entries.sort((a, b) => a.pickedUpAt - b.pickedUpAt);

    return entries.map((entry) => {
      const reader = readerMap.get(entry.readerId);
      const pickupLoc = locationMap.get(entry.pickupLocationId);
      const returnLoc = entry.dropoffLocationId
        ? locationMap.get(entry.dropoffLocationId)
        : null;

      const daysHeld = entry.returnedAt
        ? Math.max(1, Math.round((entry.returnedAt - entry.pickedUpAt) / DAY_MS))
        : null;

      return {
        readerId: entry.readerId,
        readerName: reader?.name ?? "Unknown reader",
        pickupLocation: {
          _id: entry.pickupLocationId,
          name: pickupLoc?.name ?? "Unknown location",
        },
        returnLocation: returnLoc
          ? { _id: returnLoc._id, name: returnLoc.name }
          : null,
        pickedUpAt: entry.pickedUpAt,
        returnedAt: entry.returnedAt ?? null,
        daysHeld,
        conditionAtPickup: entry.conditionAtPickup,
        conditionAtReturn: entry.conditionAtReturn ?? null,
        readerNote: entry.readerNote ?? null,
      };
    });
  },
});

export const summary = query({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    const [copy, entries] = await Promise.all([
      ctx.db.get(args.copyId),
      ctx.db
        .query("journeyEntries")
        .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
        .collect(),
    ]);

    if (!copy) throw new Error("Copy not found");

    const uniqueReaders = new Set<Id<"users">>();
    const uniqueLocations = new Set<Id<"partnerLocations">>();
    let totalDaysLent = 0;
    let completedLendings = 0;

    for (const entry of entries) {
      uniqueReaders.add(entry.readerId);
      uniqueLocations.add(entry.pickupLocationId);
      if (entry.dropoffLocationId) uniqueLocations.add(entry.dropoffLocationId);
      if (entry.returnedAt) {
        totalDaysLent += Math.max(1, Math.round((entry.returnedAt - entry.pickedUpAt) / DAY_MS));
        completedLendings++;
      }
    }

    // Look up current location and holder names
    const [currentLocation, currentHolder, book] = await Promise.all([
      copy.currentLocationId ? ctx.db.get(copy.currentLocationId) : null,
      copy.currentHolderId ? ctx.db.get(copy.currentHolderId) : null,
      ctx.db.get(copy.bookId),
    ]);

    return {
      bookTitle: book?.title ?? "Unknown book",
      bookAuthor: book?.author ?? "Unknown author",
      copyStatus: copy.status,
      copyCondition: copy.condition,
      totalReaders: uniqueReaders.size,
      uniqueLocations: uniqueLocations.size,
      totalLendings: entries.length,
      completedLendings,
      totalDaysLent,
      avgDaysPerLending: completedLendings > 0 ? Math.round(totalDaysLent / completedLendings) : null,
      currentLocation: currentLocation ? { _id: currentLocation._id, name: currentLocation.name } : null,
      currentHolder: currentHolder ? { _id: currentHolder._id, name: currentHolder.name } : null,
    };
  },
});
