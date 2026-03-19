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

  it("containingBook returns collections with containsBook flag", async () => {
    const t = convexTest(schema, modules);

    const { bookId, bookId2 } = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      const b1 = await ctx.db.insert("books", makeBook({ title: "Book One" }));
      const b2 = await ctx.db.insert("books", makeBook({ title: "Book Two" }));
      return { bookId: b1, bookId2: b2 };
    });

    const authed = t.withIdentity({ subject: "user_coll1" });

    const { _id: col1 } = await authed.mutation(api.collections.create, {
      name: "Favorites",
      isPublic: false,
    });
    const { _id: col2 } = await authed.mutation(api.collections.create, {
      name: "To Read",
      isPublic: true,
    });

    // Add book1 to col1 only
    await authed.mutation(api.collections.addBook, { collectionId: col1, bookId });

    // Check containingBook for book1
    const result = await authed.query(api.collections.containingBook, { bookId });
    expect(result).toHaveLength(2);
    const fav = result.find((c) => c.name === "Favorites");
    const toRead = result.find((c) => c.name === "To Read");
    expect(fav!.containsBook).toBe(true);
    expect(toRead!.containsBook).toBe(false);

    // Check containingBook for book2 (not in any collection)
    const result2 = await authed.query(api.collections.containingBook, { bookId: bookId2 });
    expect(result2).toHaveLength(2);
    expect(result2.every((c) => !c.containsBook)).toBe(true);
  });

  it("containingBook returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });

    const result = await t.query(api.collections.containingBook, { bookId });
    expect(result).toEqual([]);
  });

  it("publicCollections returns only public collections", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      await ctx.db.insert("collections", {
        userId: uid,
        name: "Public List",
        description: "Visible to all",
        isPublic: true,
        createdAt: 1000,
      });
      await ctx.db.insert("collections", {
        userId: uid,
        name: "Secret List",
        isPublic: false,
        createdAt: 2000,
      });
      await ctx.db.insert("collections", {
        userId: uid,
        name: "Another Public",
        isPublic: true,
        createdAt: 3000,
      });
    });

    // No auth required
    const result = await t.query(api.collections.publicCollections, {});
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Another Public");
    expect(result[1].name).toBe("Public List");
    expect(result[0].ownerName).toBe("Collection User");
  });

  it("publicCollections includes book counts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      const colId = await ctx.db.insert("collections", {
        userId: uid,
        name: "With Books",
        isPublic: true,
        createdAt: Date.now(),
      });
      const bookId = await ctx.db.insert("books", makeBook());
      const bookId2 = await ctx.db.insert("books", makeBook({ title: "Book 2" }));
      await ctx.db.insert("collectionItems", {
        collectionId: colId,
        bookId,
        addedAt: Date.now(),
      });
      await ctx.db.insert("collectionItems", {
        collectionId: colId,
        bookId: bookId2,
        addedAt: Date.now(),
      });
    });

    const result = await t.query(api.collections.publicCollections, {});
    expect(result).toHaveLength(1);
    expect(result[0].bookCount).toBe(2);
  });

  it("publicCollections returns empty when no public collections exist", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", makeUser());
      await ctx.db.insert("collections", {
        userId: uid,
        name: "Private Only",
        isPublic: false,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.collections.publicCollections, {});
    expect(result).toHaveLength(0);
  });

  it("publicCollections shows collections from multiple users", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const uid1 = await ctx.db.insert("users", makeUser());
      const uid2 = await ctx.db.insert(
        "users",
        makeUser({ clerkId: "user_coll2", name: "Other Reader", phone: "+9999999999" }),
      );
      await ctx.db.insert("collections", {
        userId: uid1,
        name: "Alice Picks",
        isPublic: true,
        createdAt: 1000,
      });
      await ctx.db.insert("collections", {
        userId: uid2,
        name: "Bob Picks",
        isPublic: true,
        createdAt: 2000,
      });
    });

    const result = await t.query(api.collections.publicCollections, {});
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Bob Picks");
    expect(result[0].ownerName).toBe("Other Reader");
    expect(result[1].name).toBe("Alice Picks");
    expect(result[1].ownerName).toBe("Collection User");
  });
});
