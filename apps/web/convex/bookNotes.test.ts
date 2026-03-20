import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_notes1",
    phone: "+1234567890",
    name: "Notes User",
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

describe("bookNotes", () => {
  it("save creates a new note and myNote retrieves it", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_notes1" });

    await authed.mutation(api.bookNotes.save, {
      bookId,
      content: "Really enjoyed chapter 3",
    });

    const note = await authed.query(api.bookNotes.myNote, { bookId });
    expect(note).not.toBeNull();
    expect(note!.content).toBe("Really enjoyed chapter 3");
  });

  it("save updates existing note (upsert)", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_notes1" });

    await authed.mutation(api.bookNotes.save, {
      bookId,
      content: "First thought",
    });

    await authed.mutation(api.bookNotes.save, {
      bookId,
      content: "Updated thought",
    });

    const note = await authed.query(api.bookNotes.myNote, { bookId });
    expect(note!.content).toBe("Updated thought");
  });

  it("save rejects empty content", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_notes1" });

    await expect(
      authed.mutation(api.bookNotes.save, { bookId, content: "   " }),
    ).rejects.toThrow("Note content is required");
  });

  it("save rejects unauthenticated users", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      return await ctx.db.insert("books", makeBook());
    });

    await expect(
      t.mutation(api.bookNotes.save, { bookId, content: "My note" }),
    ).rejects.toThrow("Not authenticated");
  });

  it("remove deletes an existing note", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_notes1" });

    await authed.mutation(api.bookNotes.save, {
      bookId,
      content: "To be deleted",
    });

    await authed.mutation(api.bookNotes.remove, { bookId });

    const note = await authed.query(api.bookNotes.myNote, { bookId });
    expect(note).toBeNull();
  });

  it("remove throws when note does not exist", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_notes1" });

    await expect(
      authed.mutation(api.bookNotes.remove, { bookId }),
    ).rejects.toThrow("Note not found");
  });

  it("myNotes returns all notes sorted by most recent", async () => {
    const t = convexTest(schema, modules);

    const { bookId1, bookId2 } = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      const b1 = await ctx.db.insert(
        "books",
        makeBook({ title: "Book One", author: "Author A" }),
      );
      const b2 = await ctx.db.insert(
        "books",
        makeBook({ title: "Book Two", author: "Author B" }),
      );
      return { bookId1: b1, bookId2: b2 };
    });

    const authed = t.withIdentity({ subject: "user_notes1" });

    await authed.mutation(api.bookNotes.save, {
      bookId: bookId1,
      content: "Note for book one",
    });
    await authed.mutation(api.bookNotes.save, {
      bookId: bookId2,
      content: "Note for book two",
    });

    const notes = await authed.query(api.bookNotes.myNotes, {});
    expect(notes).toHaveLength(2);
    const titles = notes.map((n: { bookTitle: string }) => n.bookTitle);
    expect(titles).toContain("Book One");
    expect(titles).toContain("Book Two");
  });

  it("myNotes returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.bookNotes.myNotes, {});
    expect(result).toEqual([]);
  });

  it("save rejects notes exceeding 10000 characters", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      return await ctx.db.insert("books", makeBook());
    });

    const authed = t.withIdentity({ subject: "user_notes1" });

    await expect(
      authed.mutation(api.bookNotes.save, {
        bookId,
        content: "x".repeat(10001),
      }),
    ).rejects.toThrow("Note must be 10000 characters or less");
  });

  it("notes are private — users cannot see each other's notes", async () => {
    const t = convexTest(schema, modules);

    const bookId = await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
      await ctx.db.insert(
        "users",
        makeUser({
          clerkId: "user_notes2",
          name: "Other User",
          phone: "+9999999999",
        }),
      );
      return await ctx.db.insert("books", makeBook());
    });

    const user1 = t.withIdentity({ subject: "user_notes1" });
    const user2 = t.withIdentity({ subject: "user_notes2" });

    await user1.mutation(api.bookNotes.save, {
      bookId,
      content: "User 1 secret note",
    });

    // User 2 should not see user 1's note
    const note = await user2.query(api.bookNotes.myNote, { bookId });
    expect(note).toBeNull();

    const notes = await user2.query(api.bookNotes.myNotes, {});
    expect(notes).toHaveLength(0);
  });
});
