import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_req1",
    phone: "+1234567890",
    name: "Request User",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

describe("bookRequests", () => {
  it("create posts a request and active lists it", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_req1" });

    await authed.mutation(api.bookRequests.create, {
      title: "Dune",
      author: "Frank Herbert",
      note: "Looking for the original edition",
    });

    const active = await authed.query(api.bookRequests.active, {});
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe("Dune");
    expect(active[0].author).toBe("Frank Herbert");
    expect(active[0].note).toBe("Looking for the original edition");
    expect(active[0].requesterName).toBe("Request User");
    expect(active[0].status).toBe("open");
  });

  it("create rejects empty title", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_req1" });

    await expect(
      authed.mutation(api.bookRequests.create, { title: "   " }),
    ).rejects.toThrow("Title is required");
  });

  it("create rejects unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.bookRequests.create, { title: "Dune" }),
    ).rejects.toThrow("Not authenticated");
  });

  it("create prevents duplicate open requests for same title", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_req1" });

    await authed.mutation(api.bookRequests.create, { title: "Dune" });

    await expect(
      authed.mutation(api.bookRequests.create, { title: "Dune" }),
    ).rejects.toThrow("You already have an open request for this book");
  });

  it("cancel marks request as cancelled", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_req1" });

    const requestId = await authed.mutation(api.bookRequests.create, {
      title: "Dune",
    });

    await authed.mutation(api.bookRequests.cancel, { requestId });

    const active = await authed.query(api.bookRequests.active, {});
    expect(active).toHaveLength(0);

    const mine = await authed.query(api.bookRequests.myRequests, {});
    expect(mine).toHaveLength(1);
    expect(mine[0].status).toBe("cancelled");
  });

  it("cancel rejects other user's request", async () => {
    const t = convexTest(schema, modules);

    const requestId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({
          clerkId: "user_req2",
          name: "Other User",
          phone: "+9999999999",
        }),
      );
      return await ctx.db.insert("bookRequests", {
        userId: (await ctx.db.query("users").first())!._id,
        title: "Dune",
        status: "open" as const,
        createdAt: Date.now(),
      });
    });

    const otherUser = t.withIdentity({ subject: "user_req2" });

    await expect(
      otherUser.mutation(api.bookRequests.cancel, { requestId }),
    ).rejects.toThrow("Not your request");
  });

  it("fulfill marks request as fulfilled with fulfiller info", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({
          clerkId: "user_req2",
          name: "Sharer User",
          phone: "+9999999999",
        }),
      );
    });

    const requester = t.withIdentity({ subject: "user_req1" });
    const sharer = t.withIdentity({ subject: "user_req2" });

    const requestId = await requester.mutation(api.bookRequests.create, {
      title: "Dune",
    });

    await sharer.mutation(api.bookRequests.fulfill, { requestId });

    const active = await requester.query(api.bookRequests.active, {});
    expect(active).toHaveLength(0);

    const mine = await requester.query(api.bookRequests.myRequests, {});
    expect(mine).toHaveLength(1);
    expect(mine[0].status).toBe("fulfilled");
    expect(mine[0].fulfilledBy).toBeDefined();
    expect(mine[0].fulfilledAt).toBeDefined();
  });

  it("fulfill rejects already-fulfilled request", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({
          clerkId: "user_req2",
          name: "Sharer",
          phone: "+9999999999",
        }),
      );
    });

    const requester = t.withIdentity({ subject: "user_req1" });
    const sharer = t.withIdentity({ subject: "user_req2" });

    const requestId = await requester.mutation(api.bookRequests.create, {
      title: "Dune",
    });

    await sharer.mutation(api.bookRequests.fulfill, { requestId });

    await expect(
      sharer.mutation(api.bookRequests.fulfill, { requestId }),
    ).rejects.toThrow("Request is not open");
  });

  it("myRequests returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.bookRequests.myRequests, {});
    expect(result).toEqual([]);
  });

  it("active respects limit parameter", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("bookRequests", {
          userId,
          title: `Book ${i}`,
          status: "open" as const,
          createdAt: Date.now() + i,
        });
      }
    });

    const authed = t.withIdentity({ subject: "user_req1" });

    const limited = await authed.query(api.bookRequests.active, { limit: 3 });
    expect(limited).toHaveLength(3);

    const all = await authed.query(api.bookRequests.active, {});
    expect(all).toHaveLength(5);
  });

  it("fulfill sends notification to requester", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({
          clerkId: "user_req2",
          name: "Sharer User",
          phone: "+9999999999",
        }),
      );
    });

    const requester = t.withIdentity({ subject: "user_req1" });
    const sharer = t.withIdentity({ subject: "user_req2" });

    const requestId = await requester.mutation(api.bookRequests.create, {
      title: "Dune",
    });

    await sharer.mutation(api.bookRequests.fulfill, { requestId });

    // Check that the requester received a notification
    const notifications = await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("clerkId"), "user_req1"))
        .first();
      return await ctx.db
        .query("userNotifications")
        .withIndex("by_user", (q) => q.eq("userId", user!._id))
        .collect();
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("book_request_fulfilled");
    expect(notifications[0].title).toBe("Your book request was fulfilled!");
    expect(notifications[0].message).toContain("Dune");
    expect(notifications[0].message).toContain("Sharer User");
  });

  it("fulfill does not notify when requester fulfills own request", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const requester = t.withIdentity({ subject: "user_req1" });

    const requestId = await requester.mutation(api.bookRequests.create, {
      title: "Dune",
    });

    await requester.mutation(api.bookRequests.fulfill, { requestId });

    // No notification should be sent
    const notifications = await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("clerkId"), "user_req1"))
        .first();
      return await ctx.db
        .query("userNotifications")
        .withIndex("by_user", (q) => q.eq("userId", user!._id))
        .collect();
    });

    expect(notifications).toHaveLength(0);
  });

  it("register book notifies matching open requesters", async () => {
    const t = convexTest(schema, modules);

    const locationId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({
          clerkId: "user_req2",
          name: "Sharer User",
          phone: "+9999999999",
        }),
      );
      return await ctx.db.insert("partnerLocations", {
        name: "Cafe Books",
        address: "123 Main St",
        lat: 40.7128,
        lng: -74.006,
        contactPhone: "+1111111111",
        operatingHours: {},
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 0,
        managedByUserId: userId,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
    });

    const requester = t.withIdentity({ subject: "user_req1" });
    const sharer = t.withIdentity({ subject: "user_req2" });

    // Requester asks for "Dune"
    await requester.mutation(api.bookRequests.create, {
      title: "Dune",
    });

    // Sharer registers a copy of "Dune"
    await sharer.mutation(api.books.register, {
      title: "Dune",
      author: "Frank Herbert",
      coverImage: "https://example.com/dune.jpg",
      description: "A science fiction classic",
      categories: ["Science Fiction"],
      pageCount: 412,
      language: "English",
      ownershipType: "lent",
      condition: "good",
      locationId,
    });

    // Check that the requester received a notification
    const notifications = await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("clerkId"), "user_req1"))
        .first();
      return await ctx.db
        .query("userNotifications")
        .withIndex("by_user", (q) => q.eq("userId", user!._id))
        .collect();
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("book_request_fulfilled");
    expect(notifications[0].title).toBe(
      "A book you requested is now available!",
    );
    expect(notifications[0].message).toContain("Dune");
    expect(notifications[0].message).toContain("Cafe Books");
  });

  it("register book matches requests case-insensitively", async () => {
    const t = convexTest(schema, modules);

    const locationId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({
          clerkId: "user_req2",
          name: "Sharer",
          phone: "+9999999999",
        }),
      );
      return await ctx.db.insert("partnerLocations", {
        name: "Corner Cafe",
        address: "456 Elm St",
        lat: 40.7,
        lng: -74.0,
        contactPhone: "+2222222222",
        operatingHours: {},
        photos: [],
        shelfCapacity: 30,
        currentBookCount: 0,
        managedByUserId: userId,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
    });

    const requester = t.withIdentity({ subject: "user_req1" });
    const sharer = t.withIdentity({ subject: "user_req2" });

    // Request with different casing
    await requester.mutation(api.bookRequests.create, {
      title: "the great gatsby",
    });

    // Share with proper casing
    await sharer.mutation(api.books.register, {
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      coverImage: "https://example.com/gatsby.jpg",
      description: "A novel about the American Dream",
      categories: ["Fiction"],
      pageCount: 180,
      language: "English",
      ownershipType: "lent",
      condition: "like_new",
      locationId,
    });

    const notifications = await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("clerkId"), "user_req1"))
        .first();
      return await ctx.db
        .query("userNotifications")
        .withIndex("by_user", (q) => q.eq("userId", user!._id))
        .collect();
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("book_request_fulfilled");
  });

  it("cancelled request allows re-requesting the same title", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_req1" });

    const requestId = await authed.mutation(api.bookRequests.create, {
      title: "Dune",
    });

    await authed.mutation(api.bookRequests.cancel, { requestId });

    // Should be able to request again after cancelling
    await authed.mutation(api.bookRequests.create, { title: "Dune" });

    const active = await authed.query(api.bookRequests.active, {});
    expect(active).toHaveLength(1);
  });

  it("myRequests returns all fields needed by PendingRequestsSection dashboard widget", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      // Open request
      await ctx.db.insert("bookRequests", {
        userId,
        title: "Pending Book",
        author: "Some Author",
        note: "Would love to read this",
        status: "open",
        createdAt: Date.now(),
      });
      // Fulfilled request
      await ctx.db.insert("bookRequests", {
        userId,
        title: "Found Book",
        status: "fulfilled",
        createdAt: Date.now() - 86400000,
        fulfilledAt: Date.now(),
        fulfilledBy: userId,
      });
    });

    const requests = await t.withIdentity({ subject: "user_req1" }).query(api.bookRequests.myRequests, {});
    expect(requests).toHaveLength(2);

    const open = requests.find((r: { title: string }) => r.title === "Pending Book")!;
    expect(open.status).toBe("open");
    expect(open.author).toBe("Some Author");
    expect(open.note).toBe("Would love to read this");
    expect(open).toHaveProperty("_id");

    const fulfilled = requests.find((r: { title: string }) => r.title === "Found Book")!;
    expect(fulfilled.status).toBe("fulfilled");
    expect(fulfilled.fulfilledAt).toBeTypeOf("number");
  });

  it("cancel rejects already-cancelled request", async () => {
    const t = convexTest(schema, modules);

    const { requestId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const reqId = await ctx.db.insert("bookRequests", {
        userId,
        title: "Cancelled Book",
        status: "cancelled",
        createdAt: Date.now(),
      });
      return { requestId: reqId };
    });

    const authed = t.withIdentity({ subject: "user_req1" });
    await expect(
      authed.mutation(api.bookRequests.cancel, { requestId }),
    ).rejects.toThrow("Request is not open");
  });

  it("create rejects when at max 20 open requests", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      for (let i = 0; i < 20; i++) {
        await ctx.db.insert("bookRequests", {
          userId,
          title: `Request ${i}`,
          status: "open",
          createdAt: Date.now(),
        });
      }
    });

    const authed = t.withIdentity({ subject: "user_req1" });
    await expect(
      authed.mutation(api.bookRequests.create, { title: "One Too Many" }),
    ).rejects.toThrow("Maximum 20 open book requests allowed");
  });

  it("fulfill rejects nonexistent request", async () => {
    const t = convexTest(schema, modules);

    const fakeRequestId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      const userId = (await ctx.db.query("users").first())!._id;
      const reqId = await ctx.db.insert("bookRequests", {
        userId,
        title: "Ghost Request",
        status: "open" as const,
        createdAt: Date.now(),
      });
      await ctx.db.delete(reqId);
      return reqId;
    });

    const authed = t.withIdentity({ subject: "user_req1" });
    await expect(
      authed.mutation(api.bookRequests.fulfill, { requestId: fakeRequestId }),
    ).rejects.toThrow("Request not found");
  });

  it("cancel rejects nonexistent request", async () => {
    const t = convexTest(schema, modules);

    const fakeRequestId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      const userId = (await ctx.db.query("users").first())!._id;
      const reqId = await ctx.db.insert("bookRequests", {
        userId,
        title: "Ghost Request",
        status: "open" as const,
        createdAt: Date.now(),
      });
      await ctx.db.delete(reqId);
      return reqId;
    });

    const authed = t.withIdentity({ subject: "user_req1" });
    await expect(
      authed.mutation(api.bookRequests.cancel, { requestId: fakeRequestId }),
    ).rejects.toThrow("Request not found");
  });

  it("create rejects title over 300 characters", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_req1" });
    await expect(
      authed.mutation(api.bookRequests.create, {
        title: "A".repeat(301),
      }),
    ).rejects.toThrow("Title must be 300 characters or less");
  });

  it("create rejects author over 200 characters", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_req1" });
    await expect(
      authed.mutation(api.bookRequests.create, {
        title: "Valid Title",
        author: "A".repeat(201),
      }),
    ).rejects.toThrow("Author must be 200 characters or less");
  });

  it("create rejects note over 500 characters", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_req1" });
    await expect(
      authed.mutation(api.bookRequests.create, {
        title: "Valid Title",
        note: "A".repeat(501),
      }),
    ).rejects.toThrow("Note must be 500 characters or less");
  });
});
