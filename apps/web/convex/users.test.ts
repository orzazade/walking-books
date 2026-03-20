import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_test1",
    phone: "+1234567890",
    name: "Test User",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

describe("users.ensureUser", () => {
  it("creates a new user with defaults on first call", async () => {
    const t = convexTest(schema, modules);

    const authed = t.withIdentity({ subject: "new_user_ensure", phoneNumber: "+5550001111", name: "New Reader" });
    const userId = await authed.mutation(api.users.ensureUser, {});
    expect(userId).toBeDefined();

    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user).not.toBeNull();
    expect(user!.clerkId).toBe("new_user_ensure");
    expect(user!.phone).toBe("+5550001111");
    expect(user!.name).toBe("New Reader");
    expect(user!.reputationScore).toBe(50);
    expect(user!.booksShared).toBe(0);
    expect(user!.booksRead).toBe(0);
    expect(user!.roles).toContain("reader");
  });

  it("returns existing user ID on subsequent calls (idempotent)", async () => {
    const t = convexTest(schema, modules);

    const authed = t.withIdentity({ subject: "idempotent_user", phoneNumber: "+5550002222", name: "Idem Reader" });
    const firstId = await authed.mutation(api.users.ensureUser, {});
    const secondId = await authed.mutation(api.users.ensureUser, {});
    expect(firstId).toBe(secondId);

    // Only one user record should exist
    const users = await t.run(async (ctx) =>
      ctx.db.query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "idempotent_user"))
        .collect(),
    );
    expect(users).toHaveLength(1);
  });

  it("rejects unauthenticated calls", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.users.ensureUser, {}),
    ).rejects.toThrow("Not authenticated");
  });
});

describe("users.profile", () => {
  it("returns public profile without sensitive fields", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", makeUser({ clerkId: "profile_user", phone: "+5550003333", name: "Profile User" })),
    );

    const profile = await t.query(api.users.profile, { userId });
    expect(profile).not.toBeNull();
    expect(profile!.name).toBe("Profile User");
    // Sensitive fields must be excluded
    expect("phone" in profile!).toBe(false);
    expect("clerkId" in profile!).toBe(false);
  });

  it("returns null for nonexistent user", async () => {
    const t = convexTest(schema, modules);

    const fakeId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", makeUser());
      await ctx.db.delete(id);
      return id;
    });

    const profile = await t.query(api.users.profile, { userId: fakeId });
    expect(profile).toBeNull();
  });
});

describe("users.update", () => {
  it("updates name successfully", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_upd_name" }));
    });

    const authed = t.withIdentity({ subject: "user_upd_name" });
    await authed.mutation(api.users.update, { name: "New Name" });

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "user_upd_name"))
        .unique();
    });
    expect(user!.name).toBe("New Name");
  });

  it("rejects empty name", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_upd_empty" }));
    });

    const authed = t.withIdentity({ subject: "user_upd_empty" });
    await expect(
      authed.mutation(api.users.update, { name: "   " }),
    ).rejects.toThrow("Name cannot be empty");
  });

  it("rejects invalid avatar URL", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_upd_avatar" }));
    });

    const authed = t.withIdentity({ subject: "user_upd_avatar" });
    await expect(
      authed.mutation(api.users.update, { avatarUrl: "javascript:alert(1)" }),
    ).rejects.toThrow("Avatar URL must start with http");
  });

  it("rejects too many favorite genres", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_upd_genres" }));
    });

    const genres = Array.from({ length: 21 }, (_, i) => `Genre ${i}`);
    const authed = t.withIdentity({ subject: "user_upd_genres" });
    await expect(
      authed.mutation(api.users.update, { favoriteGenres: genres }),
    ).rejects.toThrow("Maximum 20 favorite genres");
  });
});

describe("users.updateStatus", () => {
  it("rejects non-admin caller", async () => {
    const t = convexTest(schema, modules);
    const targetId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_status_caller" }));
      return await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_status_target", phone: "+6666666666" }),
      );
    });

    const authed = t.withIdentity({ subject: "user_status_caller" });
    await expect(
      authed.mutation(api.users.updateStatus, { userId: targetId, status: "restricted" }),
    ).rejects.toThrow();
  });

  it("admin can update user status", async () => {
    const t = convexTest(schema, modules);
    const targetId = await t.run(async (ctx) => {
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_status_admin", roles: ["reader", "admin"] }),
      );
      return await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_status_target2", phone: "+5555555555" }),
      );
    });

    const authed = t.withIdentity({ subject: "user_status_admin" });
    await authed.mutation(api.users.updateStatus, { userId: targetId, status: "restricted" });

    const user = await t.run(async (ctx) => ctx.db.get(targetId));
    expect(user!.status).toBe("restricted");
  });
});

describe("users.updateRoles", () => {
  it("rejects non-admin caller", async () => {
    const t = convexTest(schema, modules);
    const targetId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_roles_caller" }));
      return await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_roles_target", phone: "+9999999999" }),
      );
    });

    const authed = t.withIdentity({ subject: "user_roles_caller" });
    await expect(
      authed.mutation(api.users.updateRoles, { userId: targetId, roles: ["reader", "partner"] }),
    ).rejects.toThrow();
  });

  it("rejects invalid role names", async () => {
    const t = convexTest(schema, modules);
    const targetId = await t.run(async (ctx) => {
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_roles_admin", roles: ["reader", "admin"] }),
      );
      return await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_roles_target2", phone: "+8888888888" }),
      );
    });

    const authed = t.withIdentity({ subject: "user_roles_admin" });
    await expect(
      authed.mutation(api.users.updateRoles, { userId: targetId, roles: ["superadmin"] }),
    ).rejects.toThrow("Invalid roles: superadmin");
  });

  it("rejects empty roles array", async () => {
    const t = convexTest(schema, modules);
    const targetId = await t.run(async (ctx) => {
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_roles_admin2", roles: ["reader", "admin"] }),
      );
      return await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_roles_target3", phone: "+7777777777" }),
      );
    });

    const authed = t.withIdentity({ subject: "user_roles_admin2" });
    await expect(
      authed.mutation(api.users.updateRoles, { userId: targetId, roles: [] }),
    ).rejects.toThrow("At least one role required");
  });
});

describe("users.update field limits", () => {
  it("rejects name over 100 characters", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_name_limit" }));
    });

    const authed = t.withIdentity({ subject: "user_name_limit" });
    await expect(
      authed.mutation(api.users.update, { name: "A".repeat(101) }),
    ).rejects.toThrow("Name must be 100 characters or less");
  });

  it("rejects bio over 500 characters", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_bio_limit" }));
    });

    const authed = t.withIdentity({ subject: "user_bio_limit" });
    await expect(
      authed.mutation(api.users.update, { bio: "B".repeat(501) }),
    ).rejects.toThrow("Bio must be 500 characters or less");
  });
});

describe("users.currentUser", () => {
  it("returns null for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.users.currentUser, {});
    expect(result).toBeNull();
  });

  it("returns user data for authenticated users", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_current", name: "Current User" }));
    });

    const authed = t.withIdentity({ subject: "user_current" });
    const result = await authed.query(api.users.currentUser, {});
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Current User");
  });
});

describe("users.listAll", () => {
  it("returns empty for non-admin users", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_listall_reader" }));
    });

    const authed = t.withIdentity({ subject: "user_listall_reader" });
    const result = await authed.query(api.users.listAll, {});
    expect(result).toEqual([]);
  });

  it("returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.users.listAll, {});
    expect(result).toEqual([]);
  });

  it("returns all users for admin", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser({ clerkId: "user_listall_admin", roles: ["reader", "admin"] }));
      await ctx.db.insert("users", makeUser({ clerkId: "user_listall_other", phone: "+5550001111" }));
    });

    const authed = t.withIdentity({ subject: "user_listall_admin" });
    const result = await authed.query(api.users.listAll, {});
    expect(result).toHaveLength(2);
  });
});
