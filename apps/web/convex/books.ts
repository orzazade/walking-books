import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { getEffectiveLendingDays } from "./lib/lending";
import { conditionValidator, ownershipTypeValidator } from "./lib/validators";
import { requireCurrentUser } from "./lib/auth";

async function enrichWithAvailability<
  T extends {
    _id: string;
    title: string;
    avgRating: number;
  },
>(ctx: QueryCtx, books: Array<T>) {
  const copies = await ctx.db.query("copies").collect();
  const counts = new Map<
    string,
    {
      totalCopies: number;
      availableCopies: number;
    }
  >();

  for (const copy of copies) {
    const current = counts.get(copy.bookId) ?? {
      totalCopies: 0,
      availableCopies: 0,
    };
    current.totalCopies += 1;
    if (copy.status === "available") {
      current.availableCopies += 1;
    }
    counts.set(copy.bookId, current);
  }

  return books
    .map((book) => {
      const availability = counts.get(book._id) ?? {
        totalCopies: 0,
        availableCopies: 0,
      };

      return {
        ...book,
        ...availability,
      };
    })
    .sort((a, b) => {
      if (b.availableCopies !== a.availableCopies) {
        return b.availableCopies - a.availableCopies;
      }
      if (b.avgRating !== a.avgRating) {
        return b.avgRating - a.avgRating;
      }
      return a.title.localeCompare(b.title);
    });
}

export const lookupISBN = action({
  args: { isbn: v.string() },
  handler: async (_ctx, args) => {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${args.isbn}&format=json&jscmd=data`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const bookData = data[`ISBN:${args.isbn}`];

    if (!bookData) return null;

    return {
      title: bookData.title ?? "",
      author: bookData.authors?.[0]?.name ?? "Unknown",
      coverImage: bookData.cover?.large ?? bookData.cover?.medium ?? "",
      description:
        bookData.notes ?? bookData.excerpts?.[0]?.text ?? "",
      categories: (bookData.subjects ?? [])
        .slice(0, 5)
        .map((s: { name: string }) => s.name),
      pageCount: bookData.number_of_pages ?? 0,
      language: bookData.language?.[0]?.name ?? "English",
      publisher: bookData.publishers?.[0]?.name,
    };
  },
});

export const register = mutation({
  args: {
    title: v.string(),
    author: v.string(),
    isbn: v.optional(v.string()),
    coverImage: v.string(),
    description: v.string(),
    categories: v.array(v.string()),
    pageCount: v.number(),
    language: v.string(),
    publisher: v.optional(v.string()),
    ownershipType: ownershipTypeValidator,
    condition: conditionValidator,
    locationId: v.id("partnerLocations"),
    sharerMaxLendingDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    // Find or create book
    let bookId;
    if (args.isbn) {
      const existing = await ctx.db
        .query("books")
        .withIndex("by_isbn", (q) => q.eq("isbn", args.isbn))
        .unique();
      if (existing) {
        bookId = existing._id;
      }
    }

    if (!bookId) {
      bookId = await ctx.db.insert("books", {
        title: args.title,
        author: args.author,
        isbn: args.isbn,
        coverImage: args.coverImage,
        description: args.description,
        categories: args.categories,
        pageCount: args.pageCount,
        language: args.language,
        publisher: args.publisher,
        avgRating: 0,
        reviewCount: 0,
      });
    }

    // Calculate lending period
    const lendingPeriodDays = getEffectiveLendingDays(
      args.pageCount,
      args.sharerMaxLendingDays,
    );

    // Create copy
    const copyId = await ctx.db.insert("copies", {
      bookId,
      status: "available",
      condition: args.condition,
      ownershipType: args.ownershipType,
      originalSharerId: user._id,
      currentLocationId: args.locationId,
      currentHolderId: undefined,
      qrCodeUrl: "",
      returnDeadline: undefined,
      lendingPeriodDays,
      sharerMaxLendingDays: args.sharerMaxLendingDays,
    });

    // Update user stats
    await ctx.db.patch(user._id, {
      booksShared: user.booksShared + 1,
    });

    // Create initial condition report
    await ctx.db.insert("conditionReports", {
      copyId,
      reportedByUserId: user._id,
      reportedByPartnerId: undefined,
      type: "pickup_check",
      photos: [],
      description: `Initial condition: ${args.condition}`,
      previousCondition: args.condition,
      newCondition: args.condition,
      createdAt: Date.now(),
    });

    return { bookId, copyId };
  },
});

export const searchCatalog = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const normalizedQuery = args.query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const books = await ctx.db.query("books").collect();
    const matches = books.filter((book) => {
      const haystacks = [
        book.title,
        book.author,
        book.isbn ?? "",
        book.categories.join(" "),
      ];

      return haystacks.some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    });

    const enriched = await enrichWithAvailability(ctx, matches);
    return enriched.slice(0, 20);
  },
});

export const byCategoryCatalog = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    const books = await ctx.db.query("books").collect();
    const filtered = books.filter((book) =>
      book.categories.includes(args.category),
    );
    return await enrichWithAvailability(ctx, filtered);
  },
});

export const listCatalog = query({
  args: {},
  handler: async (ctx) => {
    const books = await ctx.db.query("books").collect();
    return await enrichWithAvailability(ctx, books);
  },
});

export const featuredCatalog = query({
  args: {},
  handler: async (ctx) => {
    const books = await ctx.db.query("books").collect();
    const enriched = await enrichWithAvailability(ctx, books);

    return enriched
      .filter((book) => book.availableCopies > 0)
      .slice(0, 6);
  },
});

export const byId = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.bookId);
  },
});
