import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { getEffectiveLendingDays } from "./lib/lending";
import { conditionValidator, ownershipTypeValidator, CONDITION_LABELS } from "./lib/validators";
import { requireCurrentUser } from "./lib/auth";
import type { Id } from "./_generated/dataModel";
import { getBookCopyCounts, getBookCopyCountsFor } from "./lib/availability";

async function enrichWithAvailability<
  T extends {
    _id: string;
    title: string;
    avgRating: number;
  },
>(ctx: QueryCtx, books: Array<T>) {
  // Use indexed per-book lookup for small lists; full scan for large catalogs
  const counts = books.length > 0 && books.length <= 50
    ? await getBookCopyCountsFor(ctx, books.map((b) => b._id as Id<"books">))
    : await getBookCopyCounts(ctx);

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
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(args.isbn)}&format=json&jscmd=data`;
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

    const title = args.title.trim();
    if (!title) throw new Error("Title is required");
    if (title.length > 300)
      throw new Error("Title must be 300 characters or less");
    const author = args.author.trim();
    if (!author) throw new Error("Author is required");
    if (author.length > 200)
      throw new Error("Author must be 200 characters or less");
    const description = args.description.trim();
    if (description.length > 2000)
      throw new Error("Description must be 2000 characters or less");
    if (!Number.isInteger(args.pageCount) || args.pageCount < 0 || args.pageCount > 10000)
      throw new Error("Page count must be a non-negative integer up to 10000");
    if (args.sharerMaxLendingDays !== undefined && (!Number.isInteger(args.sharerMaxLendingDays) || args.sharerMaxLendingDays < 1 || args.sharerMaxLendingDays > 365))
      throw new Error("Lending period must be between 1 and 365 days");
    if (args.categories.length > 10)
      throw new Error("Maximum 10 categories allowed");
    const categories = args.categories.map((cat) => {
      const trimmed = cat.trim();
      if (trimmed.length > 100)
        throw new Error("Each category must be 100 characters or less");
      return trimmed;
    });
    const coverImage = args.coverImage.trim();
    if (coverImage.length > 2000)
      throw new Error("Cover image URL must be 2000 characters or less");
    const language = args.language.trim();
    if (language.length > 50)
      throw new Error("Language must be 50 characters or less");
    const isbn = args.isbn?.trim() || undefined;
    if (isbn !== undefined && isbn.length > 20)
      throw new Error("ISBN must be 20 characters or less");
    const publisher = args.publisher?.trim() || undefined;
    if (publisher !== undefined && publisher.length > 200)
      throw new Error("Publisher must be 200 characters or less");

    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");

    // Find or create book
    let bookId;
    if (isbn) {
      const existing = await ctx.db
        .query("books")
        .withIndex("by_isbn", (q) => q.eq("isbn", isbn))
        .unique();
      if (existing) {
        bookId = existing._id;
      }
    }

    if (!bookId) {
      bookId = await ctx.db.insert("books", {
        title,
        author,
        isbn,
        coverImage,
        description,
        categories,
        pageCount: args.pageCount,
        language,
        publisher,
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
      qrCodeUrl: "",
      lendingPeriodDays,
      sharerMaxLendingDays: args.sharerMaxLendingDays,
    });

    // Update user stats, location count, and create condition report — independent of each other
    await Promise.all([
      ctx.db.patch(user._id, {
        booksShared: user.booksShared + 1,
      }),
      ctx.db.patch(args.locationId, {
        currentBookCount: location.currentBookCount + 1,
      }),
      ctx.db.insert("conditionReports", {
        copyId,
        reportedByUserId: user._id,
        type: "pickup_check",
        photos: [],
        description: `Initial condition: ${CONDITION_LABELS[args.condition]}`,
        previousCondition: args.condition,
        newCondition: args.condition,
        createdAt: Date.now(),
      }),
    ]);

    return { bookId, copyId };
  },
});

export const searchCatalog = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const normalizedQuery = args.query.trim().toLowerCase().slice(0, 200);
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
