import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./lib/auth";
import { eventTypeValidator } from "./lib/validators";

/** Upcoming events across all locations, sorted by start time. */
export const upcoming = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const events = await ctx.db
      .query("locationEvents")
      .withIndex("by_starts_at")
      .collect();

    const futureEvents = events.filter((e) => e.endsAt > now);

    // Batch-fetch locations
    const locationIds = [...new Set(futureEvents.map((e) => e.locationId))];
    const locations = await Promise.all(locationIds.map((id) => ctx.db.get(id)));
    const locationMap = new Map(
      locationIds.map((id, i) => [id as string, locations[i]]),
    );

    return futureEvents
      .sort((a, b) => a.startsAt - b.startsAt)
      .slice(0, 20)
      .map((event) => {
        const loc = locationMap.get(event.locationId as string);
        return {
          ...event,
          locationName: loc?.name ?? "Unknown",
          locationAddress: loc?.address ?? "",
        };
      });
  },
});

/** Upcoming events at a specific location. */
export const byLocation = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const events = await ctx.db
      .query("locationEvents")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();

    return events
      .filter((e) => e.endsAt > now)
      .sort((a, b) => a.startsAt - b.startsAt);
  },
});

/** Check if the current user has RSVPed to a specific event. */
export const myRsvp = query({
  args: { eventId: v.id("locationEvents") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return await ctx.db
      .query("eventRsvps")
      .withIndex("by_pair", (q) =>
        q.eq("userId", user._id).eq("eventId", args.eventId),
      )
      .unique();
  },
});

/** Current user's upcoming RSVPs, enriched with event + location details. */
export const myRsvps = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const rsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const now = Date.now();
    const enriched = await Promise.all(
      rsvps.map(async (rsvp) => {
        const event = await ctx.db.get(rsvp.eventId);
        if (!event || event.endsAt <= now) return null;
        const location = await ctx.db.get(event.locationId);
        return {
          ...event,
          rsvpId: rsvp._id,
          locationName: location?.name ?? "Unknown",
          locationAddress: location?.address ?? "",
        };
      }),
    );

    return enriched
      .filter((r) => r !== null)
      .sort((a, b) => a.startsAt - b.startsAt);
  },
});

/** Partner/staff creates an event at their location. */
export const create = mutation({
  args: {
    locationId: v.id("partnerLocations"),
    title: v.string(),
    description: v.string(),
    eventType: eventTypeValidator,
    startsAt: v.number(),
    endsAt: v.number(),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");

    const isManager = location.managedByUserId === user._id;
    const isStaff = location.staffUserIds.includes(user._id);
    if (!isManager && !isStaff)
      throw new Error("Only location managers or staff can create events");

    const title = args.title.trim();
    if (!title) throw new Error("Event title is required");
    if (title.length > 200) throw new Error("Title must be 200 characters or less");

    const description = args.description.trim();
    if (!description) throw new Error("Event description is required");
    if (description.length > 2000)
      throw new Error("Description must be 2000 characters or less");

    if (args.startsAt >= args.endsAt)
      throw new Error("Event must end after it starts");
    if (args.startsAt < Date.now() - 60_000)
      throw new Error("Event cannot start in the past");

    if (args.capacity !== undefined) {
      if (!Number.isInteger(args.capacity) || args.capacity < 1 || args.capacity > 1000)
        throw new Error("Capacity must be an integer between 1 and 1000");
    }

    return await ctx.db.insert("locationEvents", {
      locationId: args.locationId,
      createdByUserId: user._id,
      title,
      description,
      eventType: args.eventType,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      capacity: args.capacity,
      rsvpCount: 0,
    });
  },
});

/** Reader RSVPs to an event. */
export const rsvp = mutation({
  args: { eventId: v.id("locationEvents") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    if (event.endsAt <= Date.now()) throw new Error("This event has already ended");

    // Check for existing RSVP
    const existing = await ctx.db
      .query("eventRsvps")
      .withIndex("by_pair", (q) =>
        q.eq("userId", user._id).eq("eventId", args.eventId),
      )
      .unique();
    if (existing) throw new Error("You have already RSVPed to this event");

    // Check capacity
    if (event.capacity !== undefined && event.rsvpCount >= event.capacity)
      throw new Error("This event is at full capacity");

    await ctx.db.insert("eventRsvps", {
      eventId: args.eventId,
      userId: user._id,
      rsvpedAt: Date.now(),
    });
    await ctx.db.patch(args.eventId, { rsvpCount: event.rsvpCount + 1 });

    return { success: true };
  },
});

/** Reader cancels their RSVP. */
export const cancelRsvp = mutation({
  args: { eventId: v.id("locationEvents") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const rsvp = await ctx.db
      .query("eventRsvps")
      .withIndex("by_pair", (q) =>
        q.eq("userId", user._id).eq("eventId", args.eventId),
      )
      .unique();
    if (!rsvp) throw new Error("No RSVP found");

    const event = await ctx.db.get(args.eventId);
    await ctx.db.delete(rsvp._id);
    if (event && event.rsvpCount > 0) {
      await ctx.db.patch(args.eventId, { rsvpCount: event.rsvpCount - 1 });
    }

    return { success: true };
  },
});
