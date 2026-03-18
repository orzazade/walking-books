import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_wl1",
    phone: "+1234567890",
    name: "Waitlist User",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

function makeBook(overrides: Record<string, unknown> = {}) {
  return {
    title: "Popular Book",
    author: "Famous Author",
    coverImage: "/cover.jpg",
    description: "A very popular book",
    categories: ["fiction"],
    pageCount: 300,
    language: "English",
    avgRating: 4.5,
    reviewCount: 10,
    ...overrides,
  };
}

describe("waitlist", () => {
  it("join adds user to waitlist when no copies available", async () => {
    const t = convexTest(schema, modules);

    const { bookId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bId = await ctx.db.insert("books", makeBook());
      // One copy exists but is checked out
      await ctx.db.insert("copies", {
        bookId: bId,
        status: "checked_out",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        currentHolderId: userId,
        qrCodeUrl: "",
      });
      return { bookId: bId };
    });

    const authed = t.withIdentity({ subject: "user_wl1" });
    const entryId = await authed.mutation(api.waitlist.join, { bookId });
    expect(entryId).toBeDefined();

    const pos = await authed.query(api.waitlist.position, { bookId });
    expect(pos).not.toBeNull();
    expect(pos!.position).toBe(1);
    expect(pos!.status).toBe("waiting");
  });

  it("join rejects when copies are available", async () => {
    const t = convexTest(schema, modules);

    const { bookId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("copies", {
        bookId: bId,
        status: "available",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        qrCodeUrl: "",
      });
      return { bookId: bId };
    });

    const authed = t.withIdentity({ subject: "user_wl1" });
    await expect(
      authed.mutation(api.waitlist.join, { bookId }),
    ).rejects.toThrow("Copies are available");
  });

  it("join rejects duplicate waitlist entry", async () => {
    const t = convexTest(schema, modules);

    const { bookId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("copies", {
        bookId: bId,
        status: "checked_out",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        currentHolderId: userId,
        qrCodeUrl: "",
      });
      return { bookId: bId };
    });

    const authed = t.withIdentity({ subject: "user_wl1" });
    await authed.mutation(api.waitlist.join, { bookId });
    await expect(
      authed.mutation(api.waitlist.join, { bookId }),
    ).rejects.toThrow("Already on waitlist");
  });

  it("leave cancels active waitlist entry", async () => {
    const t = convexTest(schema, modules);

    const { bookId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("copies", {
        bookId: bId,
        status: "checked_out",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        currentHolderId: userId,
        qrCodeUrl: "",
      });
      return { bookId: bId };
    });

    const authed = t.withIdentity({ subject: "user_wl1" });
    await authed.mutation(api.waitlist.join, { bookId });
    await authed.mutation(api.waitlist.leave, { bookId });

    const pos = await authed.query(api.waitlist.position, { bookId });
    expect(pos).toBeNull();

    const list = await authed.query(api.waitlist.myWaitlist, {});
    expect(list).toHaveLength(0);
  });

  it("position returns FIFO order for multiple waiters", async () => {
    const t = convexTest(schema, modules);

    const { bookId } = await t.run(async (ctx) => {
      const u1 = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_wl_a", phone: "+1111111111", name: "Alice" }),
      );
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_wl_b", phone: "+2222222222", name: "Bob" }),
      );
      const bId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("copies", {
        bookId: bId,
        status: "checked_out",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: u1,
        currentHolderId: u1,
        qrCodeUrl: "",
      });
      return { bookId: bId };
    });

    const alice = t.withIdentity({ subject: "user_wl_a" });
    const bob = t.withIdentity({ subject: "user_wl_b" });

    await alice.mutation(api.waitlist.join, { bookId });
    await bob.mutation(api.waitlist.join, { bookId });

    const alicePos = await alice.query(api.waitlist.position, { bookId });
    const bobPos = await bob.query(api.waitlist.position, { bookId });

    expect(alicePos!.position).toBe(1);
    expect(bobPos!.position).toBe(2);
  });

  it("returnCopy notifies first waiter when copy becomes available", async () => {
    const t = convexTest(schema, modules);

    const { bookId, copyId, holderId, locationId } = await t.run(
      async (ctx) => {
        const waiterId = await ctx.db.insert(
          "users",
          makeUser({
            clerkId: "user_wl_waiter",
            phone: "+3333333333",
            name: "Waiter",
          }),
        );
        const holdId = await ctx.db.insert(
          "users",
          makeUser({
            clerkId: "user_wl_holder",
            phone: "+4444444444",
            name: "Holder",
          }),
        );
        const locId = await ctx.db.insert("partnerLocations", {
          name: "Test Library",
          address: "123 Main St",
          lat: 0,
          lng: 0,
          contactPhone: "+1000000000",
          operatingHours: {},
          photos: [],
          shelfCapacity: 100,
          currentBookCount: 5,
          managedByUserId: holdId,
          staffUserIds: [],
        });
        const bId = await ctx.db.insert("books", makeBook());
        const cId = await ctx.db.insert("copies", {
          bookId: bId,
          status: "checked_out",
          condition: "good",
          ownershipType: "donated",
          originalSharerId: holdId,
          currentHolderId: holdId,
          currentLocationId: locId,
          qrCodeUrl: "",
        });
        // Create journey entry so returnCopy can close it
        await ctx.db.insert("journeyEntries", {
          copyId: cId,
          readerId: holdId,
          pickupLocationId: locId,
          pickedUpAt: Date.now() - 86400000,
          conditionAtPickup: "good",
          pickupPhotos: [],
          returnPhotos: [],
        });
        // Waiter joins the waitlist
        await ctx.db.insert("waitlist", {
          userId: waiterId,
          bookId: bId,
          status: "waiting",
          joinedAt: Date.now(),
        });
        return {
          bookId: bId,
          copyId: cId,
          holderId: holdId,
          locationId: locId,
        };
      },
    );

    // Holder returns the copy
    const holder = t.withIdentity({ subject: "user_wl_holder" });
    await holder.mutation(api.copies.returnCopy, {
      copyId,
      locationId,
      conditionAtReturn: "good",
      photos: [],
    });

    // Waiter should now be notified
    const waiter = t.withIdentity({ subject: "user_wl_waiter" });
    const pos = await waiter.query(api.waitlist.position, { bookId });
    expect(pos).not.toBeNull();
    expect(pos!.status).toBe("notified");
    expect(pos!.notifiedAt).not.toBeNull();
  });

  it("myWaitlist returns active entries with book details", async () => {
    const t = convexTest(schema, modules);

    const { bookId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bId = await ctx.db.insert(
        "books",
        makeBook({ title: "Waitlisted Book" }),
      );
      await ctx.db.insert("copies", {
        bookId: bId,
        status: "checked_out",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        currentHolderId: userId,
        qrCodeUrl: "",
      });
      return { bookId: bId };
    });

    const authed = t.withIdentity({ subject: "user_wl1" });
    await authed.mutation(api.waitlist.join, { bookId });

    const list = await authed.query(api.waitlist.myWaitlist, {});
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Waitlisted Book");
    expect(list[0].author).toBe("Famous Author");
    expect(list[0].status).toBe("waiting");
    expect(list[0].position).toBe(1);
  });

  it("join throws for unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    const { bookId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", makeUser());
      const bId = await ctx.db.insert("books", makeBook());
      await ctx.db.insert("copies", {
        bookId: bId,
        status: "checked_out",
        condition: "good",
        ownershipType: "donated",
        originalSharerId: userId,
        currentHolderId: userId,
        qrCodeUrl: "",
      });
      return { bookId: bId };
    });

    await expect(
      t.mutation(api.waitlist.join, { bookId }),
    ).rejects.toThrow("Not authenticated");
  });
});
