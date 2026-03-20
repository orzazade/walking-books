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
});
