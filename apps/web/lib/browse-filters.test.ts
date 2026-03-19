import { describe, it, expect } from "vitest";
import {
  sortBooks,
  filterAvailableOnly,
  type BrowseBook,
} from "./browse-filters";

function makeBook(overrides: Partial<BrowseBook> = {}): BrowseBook {
  return {
    _id: "book_" + Math.random().toString(36).slice(2, 8),
    _creationTime: Date.now(),
    title: "Test Book",
    author: "Author",
    avgRating: 0,
    reviewCount: 0,
    availableCopies: 0,
    totalCopies: 1,
    ...overrides,
  };
}

describe("filterAvailableOnly", () => {
  it("removes books with zero available copies", () => {
    const books = [
      makeBook({ title: "Available", availableCopies: 2 }),
      makeBook({ title: "Unavailable", availableCopies: 0 }),
      makeBook({ title: "Also Available", availableCopies: 1 }),
    ];
    const result = filterAvailableOnly(books);
    expect(result).toHaveLength(2);
    expect(result.map((b) => b.title)).toEqual([
      "Available",
      "Also Available",
    ]);
  });

  it("returns empty array when no books are available", () => {
    const books = [
      makeBook({ availableCopies: 0 }),
      makeBook({ availableCopies: 0 }),
    ];
    expect(filterAvailableOnly(books)).toHaveLength(0);
  });

  it("returns all books when all are available", () => {
    const books = [
      makeBook({ availableCopies: 3 }),
      makeBook({ availableCopies: 1 }),
    ];
    expect(filterAvailableOnly(books)).toHaveLength(2);
  });
});

describe("sortBooks", () => {
  const bookA = makeBook({
    title: "Alpha",
    availableCopies: 1,
    avgRating: 3,
    reviewCount: 5,
    _creationTime: 1000,
  });
  const bookB = makeBook({
    title: "Bravo",
    availableCopies: 5,
    avgRating: 4.5,
    reviewCount: 10,
    _creationTime: 3000,
  });
  const bookC = makeBook({
    title: "Charlie",
    availableCopies: 0,
    avgRating: 5,
    reviewCount: 2,
    _creationTime: 2000,
  });
  const books = [bookA, bookB, bookC];

  it("sorts by availability descending (default)", () => {
    const result = sortBooks(books, "availability");
    expect(result.map((b) => b.title)).toEqual(["Bravo", "Alpha", "Charlie"]);
  });

  it("sorts by rating descending", () => {
    const result = sortBooks(books, "rating");
    expect(result.map((b) => b.title)).toEqual(["Charlie", "Bravo", "Alpha"]);
  });

  it("sorts by title alphabetically", () => {
    const result = sortBooks(books, "title");
    expect(result.map((b) => b.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("sorts by newest (creation time descending)", () => {
    const result = sortBooks(books, "newest");
    expect(result.map((b) => b.title)).toEqual(["Bravo", "Charlie", "Alpha"]);
  });

  it("breaks availability ties by rating then title", () => {
    const tied1 = makeBook({
      title: "Zebra",
      availableCopies: 2,
      avgRating: 3,
    });
    const tied2 = makeBook({
      title: "Apex",
      availableCopies: 2,
      avgRating: 3,
    });
    const tied3 = makeBook({
      title: "Mid",
      availableCopies: 2,
      avgRating: 5,
    });
    const result = sortBooks([tied1, tied2, tied3], "availability");
    expect(result.map((b) => b.title)).toEqual(["Mid", "Apex", "Zebra"]);
  });

  it("does not mutate the original array", () => {
    const original = [bookA, bookB, bookC];
    const copy = [...original];
    sortBooks(original, "rating");
    expect(original.map((b) => b.title)).toEqual(copy.map((b) => b.title));
  });
});
