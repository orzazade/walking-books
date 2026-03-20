import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_ev1",
    phone: "+1234567890",
    name: "Event User",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

function makeLocation(managerId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Cafe",
    address: "123 Main St",
    lat: 0,
    lng: 0,
    contactPhone: "+1000000000",
    operatingHours: {},
    photos: [],
    shelfCapacity: 50,
    currentBookCount: 0,
    managedByUserId: managerId,
    staffUserIds: [],
    avgRating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

describe("locationEvents", () => {
  it("manager can create an event and reader can RSVP", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111", name: "Manager" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const manager = t.withIdentity({ subject: "manager1" });

    const startsAt = Date.now() + 86400000; // tomorrow
    const endsAt = startsAt + 7200000; // +2h

    const eventId = await manager.mutation(api.locationEvents.create, {
      locationId,
      title: "Friday Book Club",
      description: "Discussing 'The Great Gatsby'",
      eventType: "book_club",
      startsAt,
      endsAt,
      capacity: 20,
    });

    expect(eventId).toBeDefined();

    // Check it appears in byLocation
    const events = await t.query(api.locationEvents.byLocation, { locationId });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Friday Book Club");
    expect(events[0].rsvpCount).toBe(0);

    // Reader RSVPs
    const reader = t.withIdentity({ subject: "user_ev1" });
    await reader.mutation(api.locationEvents.rsvp, { eventId });

    const eventsAfter = await t.query(api.locationEvents.byLocation, { locationId });
    expect(eventsAfter[0].rsvpCount).toBe(1);

    // Reader cancels RSVP
    await reader.mutation(api.locationEvents.cancelRsvp, { eventId });
    const eventsFinal = await t.query(api.locationEvents.byLocation, { locationId });
    expect(eventsFinal[0].rsvpCount).toBe(0);
  });

  it("non-manager/staff cannot create events", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const reader = t.withIdentity({ subject: "user_ev1" });

    await expect(
      reader.mutation(api.locationEvents.create, {
        locationId,
        title: "My Event",
        description: "Trying to create",
        eventType: "other",
        startsAt: Date.now() + 86400000,
        endsAt: Date.now() + 90000000,
      }),
    ).rejects.toThrow("Only location managers or staff can create events");
  });

  it("enforces capacity limit on RSVPs", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      await ctx.db.insert("users", makeUser({ clerkId: "user_ev2", phone: "+2222222222" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const manager = t.withIdentity({ subject: "manager1" });
    const eventId = await manager.mutation(api.locationEvents.create, {
      locationId,
      title: "Tiny Meetup",
      description: "Very small event",
      eventType: "reading_meetup",
      startsAt: Date.now() + 86400000,
      endsAt: Date.now() + 90000000,
      capacity: 1,
    });

    // First RSVP succeeds
    const reader1 = t.withIdentity({ subject: "user_ev1" });
    await reader1.mutation(api.locationEvents.rsvp, { eventId });

    // Second RSVP fails
    const reader2 = t.withIdentity({ subject: "user_ev2" });
    await expect(
      reader2.mutation(api.locationEvents.rsvp, { eventId }),
    ).rejects.toThrow("This event is at full capacity");
  });

  it("myRsvps returns the current user's upcoming RSVPs with location details", async () => {
    const t = convexTest(schema, modules);

    const { locationId, eventId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111", name: "Manager" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string, { name: "Book Nook" }));
      const evId = await ctx.db.insert("locationEvents", {
        locationId: locId,
        createdByUserId: managerId,
        title: "Poetry Night",
        description: "Read your poems",
        eventType: "other" as const,
        startsAt: Date.now() + 86400000,
        endsAt: Date.now() + 90000000,
        rsvpCount: 0,
      });
      return { locationId: locId, eventId: evId };
    });

    // Reader RSVPs
    const reader = t.withIdentity({ subject: "user_ev1" });
    await reader.mutation(api.locationEvents.rsvp, { eventId });

    // myRsvps should return the event enriched with location name
    const rsvps = await reader.query(api.locationEvents.myRsvps);
    expect(rsvps).toHaveLength(1);
    expect(rsvps[0].title).toBe("Poetry Night");
    expect(rsvps[0].locationName).toBe("Book Nook");
    expect(rsvps[0].rsvpId).toBeDefined();

    // After cancelling, myRsvps should be empty
    await reader.mutation(api.locationEvents.cancelRsvp, { eventId });
    const rsvpsAfter = await reader.query(api.locationEvents.myRsvps);
    expect(rsvpsAfter).toHaveLength(0);
  });

  it("create validates title, timestamps, and capacity", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const manager = t.withIdentity({ subject: "manager1" });
    const base = {
      locationId,
      title: "Valid Event",
      description: "A description",
      eventType: "workshop" as const,
      startsAt: Date.now() + 86400000,
      endsAt: Date.now() + 90000000,
    };

    // Empty title
    await expect(
      manager.mutation(api.locationEvents.create, { ...base, title: "   " }),
    ).rejects.toThrow("Event title is required");

    // End before start
    await expect(
      manager.mutation(api.locationEvents.create, { ...base, endsAt: base.startsAt - 1000 }),
    ).rejects.toThrow("Event must end after it starts");

    // Invalid capacity
    await expect(
      manager.mutation(api.locationEvents.create, { ...base, capacity: 0 }),
    ).rejects.toThrow("Capacity must be an integer between 1 and 1000");

    // Valid creation succeeds
    const eventId = await manager.mutation(api.locationEvents.create, base);
    expect(eventId).toBeDefined();
  });

  it("rejects duplicate RSVP to the same event", async () => {
    const t = convexTest(schema, modules);

    const { eventId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      const evId = await ctx.db.insert("locationEvents", {
        locationId: locId,
        createdByUserId: managerId,
        title: "Dup RSVP Test",
        description: "Testing duplicate",
        eventType: "other" as const,
        startsAt: Date.now() + 86400000,
        endsAt: Date.now() + 90000000,
        rsvpCount: 0,
      });
      return { eventId: evId };
    });

    const reader = t.withIdentity({ subject: "user_ev1" });
    await reader.mutation(api.locationEvents.rsvp, { eventId });

    await expect(
      reader.mutation(api.locationEvents.rsvp, { eventId }),
    ).rejects.toThrow("You have already RSVPed to this event");
  });

  it("rejects RSVP to an ended event", async () => {
    const t = convexTest(schema, modules);

    const { eventId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      const evId = await ctx.db.insert("locationEvents", {
        locationId: locId,
        createdByUserId: managerId,
        title: "Past Event",
        description: "Already over",
        eventType: "other" as const,
        startsAt: Date.now() - 90000000,
        endsAt: Date.now() - 86400000, // ended yesterday
        rsvpCount: 0,
      });
      return { eventId: evId };
    });

    const reader = t.withIdentity({ subject: "user_ev1" });
    await expect(
      reader.mutation(api.locationEvents.rsvp, { eventId }),
    ).rejects.toThrow("This event has already ended");
  });

  it("upcoming query returns events across locations enriched with location name", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string, { name: "Cozy Cafe" }));
      await ctx.db.insert("locationEvents", {
        locationId: locId,
        createdByUserId: managerId,
        title: "Author Talk",
        description: "Meet the author",
        eventType: "author_visit" as const,
        startsAt: Date.now() + 86400000,
        endsAt: Date.now() + 90000000,
        rsvpCount: 3,
      });
    });

    const events = await t.query(api.locationEvents.upcoming);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Author Talk");
    expect(events[0].locationName).toBe("Cozy Cafe");
  });

  it("create rejects event starting in the past", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const manager = t.withIdentity({ subject: "manager1" });
    await expect(
      manager.mutation(api.locationEvents.create, {
        locationId,
        title: "Past Event",
        description: "Already happened",
        eventType: "workshop",
        startsAt: Date.now() - 86400000,
        endsAt: Date.now() - 82800000,
      }),
    ).rejects.toThrow("Event cannot start in the past");
  });

  it("create rejects description over 2000 characters", async () => {
    const t = convexTest(schema, modules);

    const { locationId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      return { locationId: locId };
    });

    const manager = t.withIdentity({ subject: "manager1" });
    await expect(
      manager.mutation(api.locationEvents.create, {
        locationId,
        title: "Long Description Event",
        description: "A".repeat(2001),
        eventType: "reading_meetup",
        startsAt: Date.now() + 86400000,
        endsAt: Date.now() + 90000000,
      }),
    ).rejects.toThrow("Description must be 2000 characters or less");
  });

  it("cancelRsvp rejects when no RSVP exists", async () => {
    const t = convexTest(schema, modules);

    const { eventId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager_cancel1", phone: "+1111111199", name: "Manager" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      const evId = await ctx.db.insert("locationEvents", {
        locationId: locId,
        title: "Cancel Test Event",
        description: "Test",
        eventType: "reading_meetup",
        startsAt: Date.now() + 86400000,
        endsAt: Date.now() + 90000000,
        rsvpCount: 0,
        createdByUserId: managerId,
      });
      return { eventId: evId };
    });

    const authed = t.withIdentity({ subject: "user_ev1" });

    await expect(
      authed.mutation(api.locationEvents.cancelRsvp, { eventId }),
    ).rejects.toThrow("No RSVP found");
  });

  it("rsvp rejects nonexistent event", async () => {
    const t = convexTest(schema, modules);

    const fakeEventId = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager_rsvp_nope", phone: "+1111111197", name: "Manager" }));
      await ctx.db.insert("users", makeUser());
      const locId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      const evId = await ctx.db.insert("locationEvents", {
        locationId: locId,
        title: "Ghost Event",
        description: "Disappearing",
        eventType: "reading_meetup",
        startsAt: Date.now() + 86400000,
        endsAt: Date.now() + 90000000,
        rsvpCount: 0,
        createdByUserId: managerId,
      });
      await ctx.db.delete(evId);
      return evId;
    });

    const authed = t.withIdentity({ subject: "user_ev1" });
    await expect(
      authed.mutation(api.locationEvents.rsvp, { eventId: fakeEventId }),
    ).rejects.toThrow("Event not found");
  });
});
