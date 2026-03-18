import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_coll1",
    phone: "+1234567890",
    name: "Collection User",
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
    title: "Test Book",
    author: "Test Author",
    coverImage: "",
    description: "",
    categories: ["fiction"],
    pageCount: 200,
    language: "English",
    avgRating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

describe("collections", () => {
  it("create makes a new collection", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_coll1" });

    const result = await authed.mutation(api.collections.create, {
      name: "Summer Reading",
      description: "Books for the beach",
      isPublic: true,
    });
    expect(result._id).toBeDefined();

    const collections = await authed.query(api.collections.myCollections, {});
    expect(collections).toHaveLength(1);
    expect(collections[0].name).toBe("Summer Reading");
    expect(collections[0].bookCount).toBe(0);
  });

  it("create rejects empty name", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const authed = t.withIdentity({ subject: "user_coll1" });

    await expect(
      authed.mutation(api.collections.create, {
        name: "   ",
        isPublic: false,
      }),
    ).rejects.toThrow("Collection name is required");
  });

  it("create rejects unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.collections.create, {
        name: "My List",
        isPublic: false,
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("addBook and removeBook manage collection items", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_coll1" });

    const { _id: collectionId } = await authed.mutation(
      api.collections.create,
      { name: "Favorites", isPublic: false },
    );

    // Add a book
    const item = await authed.mutation(api.collections.addBook, {
      collectionId,
      bookId,
    });
    expect(item._id).toBeDefined();

    // Verify it appears in the collection
    const detail = await authed.query(api.collections.getCollection, {
      collectionId,
    });
    expect(detail!.books).toHaveLength(1);
    expect(detail!.books[0].book.title).toBe("Test Book");

    // Remove the book
    await authed.mutation(api.collections.removeBook, {
      collectionId,
      bookId,
    });

    const afterRemove = await authed.query(api.collections.getCollection, {
      collectionId,
    });
    expect(afterRemove!.books).toHaveLength(0);
  });

  it("addBook rejects duplicate books in same collection", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_coll1" });

    const { _id: collectionId } = await authed.mutation(
      api.collections.create,
      { name: "Dupes", isPublic: false },
    );

    await authed.mutation(api.collections.addBook, { collectionId, bookId });

    await expect(
      authed.mutation(api.collections.addBook, { collectionId, bookId }),
    ).rejects.toThrow("Book already in collection");
  });

  it("remove deletes collection and all its items", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_coll1" });

    const { _id: collectionId } = await authed.mutation(
      api.collections.create,
      { name: "To Delete", isPublic: false },
    );

    await authed.mutation(api.collections.addBook, { collectionId, bookId });

    await authed.mutation(api.collections.remove, { collectionId });

    const collections = await authed.query(api.collections.myCollections, {});
    expect(collections).toHaveLength(0);
  });

  it("private collections are hidden from other users", async () => {
    const t = convexTest(schema, modules);

    const collectionId = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_coll2", name: "Other User", phone: "+9999999999" }),
      );
      return await ctx.db.insert("collections", {
        userId: uid,
        name: "Secret List",
        isPublic: false,
        createdAt: Date.now(),
      });
    });

    // Other user can't see the private collection
    const otherAuthed = t.withIdentity({ subject: "user_coll2" });
    const result = await otherAuthed.query(api.collections.getCollection, {
      collectionId,
    });
    expect(result).toBeNull();
  });

  it("public collections are visible to other users", async () => {
    const t = convexTest(schema, modules);

    const collectionId = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_coll2", name: "Other User", phone: "+9999999999" }),
      );
      return await ctx.db.insert("collections", {
        userId: uid,
        name: "Public List",
        isPublic: true,
        createdAt: Date.now(),
      });
    });

    const otherAuthed = t.withIdentity({ subject: "user_coll2" });
    const result = await otherAuthed.query(api.collections.getCollection, {
      collectionId,
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Public List");
    expect(result!.ownerName).toBe("Collection User");
  });

  it("remove rejects unauthorized users", async () => {
    const t = convexTest(schema, modules);

    const collectionId = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_coll2", name: "Intruder", phone: "+9999999999" }),
      );
      return await ctx.db.insert("collections", {
        userId: uid,
        name: "Protected",
        isPublic: true,
        createdAt: Date.now(),
      });
    });

    const otherAuthed = t.withIdentity({ subject: "user_coll2" });
    await expect(
      otherAuthed.mutation(api.collections.remove, { collectionId }),
    ).rejects.toThrow("Not authorized");
  });

  it("myCollections returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.collections.myCollections, {});
    expect(result).toEqual([]);
  });
});
