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
});
