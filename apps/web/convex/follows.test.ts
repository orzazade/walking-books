import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(clerkId: string, name: string, extra?: Partial<{ bio: string; booksRead: number; booksShared: number; favoriteGenres: string[] }>) {
  return {
    clerkId,
    phone: `+1${clerkId.replace(/\D/g, "").padEnd(10, "0")}`,
    name,
    roles: ["reader" as const],
    status: "active" as const,
    reputationScore: 50,
    booksShared: extra?.booksShared ?? 0,
    booksRead: extra?.booksRead ?? 0,
    favoriteGenres: extra?.favoriteGenres ?? [],
    bio: extra?.bio,
  };
}

describe("follows enriched queries", () => {
  it("myFollowingEnriched returns empty for unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.follows.myFollowingEnriched, {});
    expect(result).toEqual([]);
  });

  it("myFollowersEnriched returns empty for unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.follows.myFollowersEnriched, {});
    expect(result).toEqual([]);
  });

  it("myFollowingEnriched returns empty when not following anyone", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser("user_a", "Alice"));
    });
    const result = await t
      .withIdentity({ subject: "user_a" })
      .query(api.follows.myFollowingEnriched, {});
    expect(result).toEqual([]);
  });

  it("myFollowingEnriched returns enriched user profiles", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const alice = await ctx.db.insert("users", makeUser("user_a", "Alice"));
      const bob = await ctx.db.insert("users", makeUser("user_b", "Bob", { bio: "Book lover", booksRead: 10, favoriteGenres: ["fiction"] }));
      await ctx.db.insert("follows", { followerId: alice, followingId: bob });
    });
    const result = await t
      .withIdentity({ subject: "user_a" })
      .query(api.follows.myFollowingEnriched, {});
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Bob");
    expect(result[0].bio).toBe("Book lover");
    expect(result[0].booksRead).toBe(10);
    expect(result[0].favoriteGenres).toEqual(["fiction"]);
    // Should not include sensitive fields
    expect(result[0]).not.toHaveProperty("phone");
    expect(result[0]).not.toHaveProperty("clerkId");
  });

  it("myFollowersEnriched returns enriched user profiles", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const alice = await ctx.db.insert("users", makeUser("user_a", "Alice"));
      const bob = await ctx.db.insert("users", makeUser("user_b", "Bob", { booksShared: 5 }));
      await ctx.db.insert("follows", { followerId: bob, followingId: alice });
    });
    const result = await t
      .withIdentity({ subject: "user_a" })
      .query(api.follows.myFollowersEnriched, {});
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Bob");
    expect(result[0].booksShared).toBe(5);
    expect(result[0]).not.toHaveProperty("phone");
    expect(result[0]).not.toHaveProperty("clerkId");
  });

  it("myFollowingEnriched returns multiple users", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const alice = await ctx.db.insert("users", makeUser("user_a", "Alice"));
      const bob = await ctx.db.insert("users", makeUser("user_b", "Bob"));
      const carol = await ctx.db.insert("users", makeUser("user_c", "Carol"));
      await ctx.db.insert("follows", { followerId: alice, followingId: bob });
      await ctx.db.insert("follows", { followerId: alice, followingId: carol });
    });
    const result = await t
      .withIdentity({ subject: "user_a" })
      .query(api.follows.myFollowingEnriched, {});
    expect(result).toHaveLength(2);
    const names = result.map((u) => u.name).sort();
    expect(names).toEqual(["Bob", "Carol"]);
  });

  it("myFollowingEnriched skips deleted users", async () => {
    const t = convexTest(schema, modules);
    let bobId: string;
    await t.run(async (ctx) => {
      const alice = await ctx.db.insert("users", makeUser("user_a", "Alice"));
      bobId = await ctx.db.insert("users", makeUser("user_b", "Bob"));
      await ctx.db.insert("follows", { followerId: alice, followingId: bobId });
      await ctx.db.delete(bobId);
    });
    const result = await t
      .withIdentity({ subject: "user_a" })
      .query(api.follows.myFollowingEnriched, {});
    expect(result).toEqual([]);
  });

  it("friendsReading returns empty for unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.follows.friendsReading, {});
    expect(result).toEqual([]);
  });

  it("friendsReading returns books held by followed users", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const alice = await ctx.db.insert("users", makeUser("user_a", "Alice"));
      const bob = await ctx.db.insert("users", makeUser("user_b", "Bob"));
      await ctx.db.insert("follows", { followerId: alice, followingId: bob });

      const bookId = await ctx.db.insert("books", {
        title: "Great Novel",
        author: "Jane Author",
        coverImage: "/cover.jpg",
        description: "A great book",
        categories: ["fiction"],
        pageCount: 300,
        language: "English",
        avgRating: 4.2,
        reviewCount: 5,
      });
      await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: alice,
        currentHolderId: bob,
        qrCodeUrl: "qr://test",
      });
    });

    const result = await t
      .withIdentity({ subject: "user_a" })
      .query(api.follows.friendsReading, {});
    expect(result).toHaveLength(1);
    expect(result[0].userName).toBe("Bob");
    expect(result[0].bookTitle).toBe("Great Novel");
    expect(result[0].bookAuthor).toBe("Jane Author");
    expect(result[0].coverImage).toBe("/cover.jpg");
  });

  it("friendsReading excludes books held by non-followed users", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const alice = await ctx.db.insert("users", makeUser("user_a", "Alice"));
      const bob = await ctx.db.insert("users", makeUser("user_b", "Bob"));
      // Alice does NOT follow Bob

      const bookId = await ctx.db.insert("books", {
        title: "Hidden Book",
        author: "Unknown",
        coverImage: "",
        description: "",
        categories: [],
        pageCount: 100,
        language: "English",
        avgRating: 0,
        reviewCount: 0,
      });
      await ctx.db.insert("copies", {
        bookId,
        status: "checked_out",
        condition: "good",
        ownershipType: "lent",
        originalSharerId: alice,
        currentHolderId: bob,
        qrCodeUrl: "qr://test2",
      });
    });

    const result = await t
      .withIdentity({ subject: "user_a" })
      .query(api.follows.friendsReading, {});
    expect(result).toEqual([]);
  });

  it("toggle rejects self-follow", async () => {
    const t = convexTest(schema, modules);
    let aliceId: string;
    await t.run(async (ctx) => {
      aliceId = await ctx.db.insert("users", makeUser("user_a", "Alice"));
    });

    await expect(
      t.withIdentity({ subject: "user_a" })
        .mutation(api.follows.toggle, { targetUserId: aliceId! as any }),
    ).rejects.toThrow("Cannot follow yourself");
  });

  it("toggle creates and removes follows", async () => {
    const t = convexTest(schema, modules);
    let bobId: string;
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser("user_a", "Alice"));
      bobId = await ctx.db.insert("users", makeUser("user_b", "Bob"));
    });

    // Follow
    const r1 = await t
      .withIdentity({ subject: "user_a" })
      .mutation(api.follows.toggle, { targetUserId: bobId! as any });
    expect(r1.following).toBe(true);

    // Verify enriched list
    const following = await t
      .withIdentity({ subject: "user_a" })
      .query(api.follows.myFollowingEnriched, {});
    expect(following).toHaveLength(1);

    // Unfollow
    const r2 = await t
      .withIdentity({ subject: "user_a" })
      .mutation(api.follows.toggle, { targetUserId: bobId! as any });
    expect(r2.following).toBe(false);

    // Verify empty
    const following2 = await t
      .withIdentity({ subject: "user_a" })
      .query(api.follows.myFollowingEnriched, {});
    expect(following2).toEqual([]);
  });

  it("toggle rejects unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    const targetId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", makeUser("user_target", "Target"));
    });

    await expect(
      t.mutation(api.follows.toggle, { targetUserId: targetId }),
    ).rejects.toThrow("Not authenticated");
  });

  it("toggle rejects nonexistent target user", async () => {
    const t = convexTest(schema, modules);

    const fakeUserId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser("user_follow_nope", "Follower"));
      const uid = await ctx.db.insert("users", makeUser("user_ghost", "Ghost"));
      await ctx.db.delete(uid);
      return uid;
    });

    const authed = t.withIdentity({ subject: "user_follow_nope" });

    await expect(
      authed.mutation(api.follows.toggle, { targetUserId: fakeUserId }),
    ).rejects.toThrow("User not found");
  });
});
