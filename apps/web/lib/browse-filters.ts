export type SortOption = "availability" | "rating" | "title" | "newest";

interface BrowseBook {
  _id: string;
  _creationTime: number;
  title: string;
  author: string;
  avgRating: number;
  reviewCount: number;
  availableCopies: number;
  totalCopies: number;
}

export function filterAvailableOnly<T extends { availableCopies: number }>(
  books: T[],
): T[] {
  return books.filter((b) => b.availableCopies > 0);
}

export function sortBooks<T extends BrowseBook>(
  books: T[],
  sort: SortOption,
): T[] {
  const sorted = [...books];
  sorted.sort((a, b) => {
    switch (sort) {
      case "availability":
        if (b.availableCopies !== a.availableCopies)
          return b.availableCopies - a.availableCopies;
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        return a.title.localeCompare(b.title);
      case "rating":
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        if (b.reviewCount !== a.reviewCount)
          return b.reviewCount - a.reviewCount;
        return a.title.localeCompare(b.title);
      case "title":
        return a.title.localeCompare(b.title);
      case "newest":
        return b._creationTime - a._creationTime;
    }
  });
  return sorted;
}

export const SORT_LABELS: Record<SortOption, string> = {
  availability: "Availability",
  rating: "Top Rated",
  title: "Title A–Z",
  newest: "Newest",
};

export const SORT_OPTIONS: SortOption[] = [
  "availability",
  "rating",
  "title",
  "newest",
];
