import { internalMutation } from "./_generated/server";
import { DAY_MS } from "./lib/lending";

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingBook = await ctx.db.query("books").first();
    if (existingBook) {
      console.log("Database already seeded, skipping");
      return;
    }

    console.log("[seed] Starting seed data insertion...");

    // --- Seed User (used as sharer/manager) ---
    const seedUserId = await ctx.db.insert("users", {
      clerkId: "seed_user_001",
      phone: "+994501234567",
      name: "Seed Admin",
      bio: "Platform seed account for development data.",
      roles: ["reader", "partner", "admin"],
      status: "active",
      reputationScore: 100,
      booksShared: 10,
      booksRead: 25,
      favoriteGenres: ["Fiction", "Science", "History"],
    });

    const readerUserId = await ctx.db.insert("users", {
      clerkId: "seed_user_002",
      phone: "+994551234567",
      name: "Leyla Mammadova",
      bio: "Avid reader and book lover from Baku.",
      roles: ["reader"],
      status: "active",
      reputationScore: 75,
      booksShared: 3,
      booksRead: 12,
      favoriteGenres: ["Fiction", "Philosophy", "Poetry"],
    });

    // --- 3 Partner Locations (cafes in Baku) ---
    const locations = [
      {
        name: "Kitab Evi Cafe",
        address: "28 May St, Baku 1010",
        lat: 40.3725,
        lng: 49.8531,
        contactPhone: "+994124901234",
        contactEmail: "hello@kitabevi.az",
        operatingHours: {
          mon: "09:00-22:00",
          tue: "09:00-22:00",
          wed: "09:00-22:00",
          thu: "09:00-22:00",
          fri: "09:00-23:00",
          sat: "10:00-23:00",
          sun: "10:00-21:00",
        },
        photos: [],
        shelfCapacity: 50,
        currentBookCount: 8,
      },
      {
        name: "Mokka Coffee Bar",
        address: "Nizami St 67, Baku 1005",
        lat: 40.3694,
        lng: 49.8372,
        contactPhone: "+994124905678",
        contactEmail: "books@mokka.az",
        operatingHours: {
          mon: "08:00-23:00",
          tue: "08:00-23:00",
          wed: "08:00-23:00",
          thu: "08:00-23:00",
          fri: "08:00-00:00",
          sat: "09:00-00:00",
          sun: "09:00-22:00",
        },
        photos: [],
        shelfCapacity: 30,
        currentBookCount: 5,
      },
      {
        name: "Port Baku Books & Brew",
        address: "Port Baku Mall, Level 2, Baku 1010",
        lat: 40.3598,
        lng: 49.8286,
        contactPhone: "+994124909012",
        contactEmail: "info@portbakubrews.az",
        operatingHours: {
          mon: "10:00-22:00",
          tue: "10:00-22:00",
          wed: "10:00-22:00",
          thu: "10:00-22:00",
          fri: "10:00-23:00",
          sat: "10:00-23:00",
          sun: "11:00-21:00",
        },
        photos: [],
        shelfCapacity: 40,
        currentBookCount: 7,
      },
    ];

    const locationIds = [];
    for (const loc of locations) {
      const id = await ctx.db.insert("partnerLocations", {
        ...loc,
        managedByUserId: seedUserId,
        staffUserIds: [],
        avgRating: 0,
        reviewCount: 0,
      });
      locationIds.push(id);
    }

    // --- 10 Books ---
    const booksData = [
      {
        title: "1984",
        author: "George Orwell",
        isbn: "9780451524935",
        description:
          "A dystopian novel about totalitarianism, surveillance, and the manipulation of truth.",
        categories: ["Fiction", "Dystopian", "Classics"],
        pageCount: 328,
        language: "English",
        publisher: "Signet Classics",
      },
      {
        title: "Sapiens: A Brief History of Humankind",
        author: "Yuval Noah Harari",
        isbn: "9780062316097",
        description:
          "A groundbreaking narrative of humanity's creation and evolution.",
        categories: ["Non-Fiction", "History", "Science"],
        pageCount: 464,
        language: "English",
        publisher: "Harper",
      },
      {
        title: "The Alchemist",
        author: "Paulo Coelho",
        isbn: "9780062315007",
        description:
          "A magical story about following your dreams and listening to your heart.",
        categories: ["Fiction", "Philosophy", "Adventure"],
        pageCount: 208,
        language: "English",
        publisher: "HarperOne",
      },
      {
        title: "To Kill a Mockingbird",
        author: "Harper Lee",
        isbn: "9780061120084",
        description:
          "A classic of modern American literature about racial injustice and moral growth.",
        categories: ["Fiction", "Classics", "Drama"],
        pageCount: 336,
        language: "English",
        publisher: "Harper Perennial",
      },
      {
        title: "Atomic Habits",
        author: "James Clear",
        isbn: "9780735211292",
        description:
          "Tiny changes, remarkable results. A proven framework for improving every day.",
        categories: ["Non-Fiction", "Self-Help", "Psychology"],
        pageCount: 320,
        language: "English",
        publisher: "Avery",
      },
      {
        title: "The Great Gatsby",
        author: "F. Scott Fitzgerald",
        isbn: "9780743273565",
        description:
          "A portrait of the Jazz Age and the American Dream's corruption.",
        categories: ["Fiction", "Classics"],
        pageCount: 180,
        language: "English",
        publisher: "Scribner",
      },
      {
        title: "Thinking, Fast and Slow",
        author: "Daniel Kahneman",
        isbn: "9780374533557",
        description:
          "Exploration of the two systems that drive the way we think.",
        categories: ["Non-Fiction", "Psychology", "Science"],
        pageCount: 499,
        language: "English",
        publisher: "Farrar, Straus and Giroux",
      },
      {
        title: "The Little Prince",
        author: "Antoine de Saint-Exupery",
        isbn: "9780156012195",
        description:
          "A poetic tale about a young prince who travels the universe learning about life and love.",
        categories: ["Fiction", "Philosophy", "Children"],
        pageCount: 96,
        language: "English",
        publisher: "Mariner Books",
      },
      {
        title: "Dune",
        author: "Frank Herbert",
        isbn: "9780441013593",
        description:
          "An epic science fiction saga of politics, religion, and ecology on a desert planet.",
        categories: ["Fiction", "Science Fiction"],
        pageCount: 688,
        language: "English",
        publisher: "Ace Books",
      },
      {
        title: "Man's Search for Meaning",
        author: "Viktor E. Frankl",
        isbn: "9780807014295",
        description:
          "A memoir and psychological exploration of finding purpose in suffering.",
        categories: ["Non-Fiction", "Psychology", "Philosophy"],
        pageCount: 184,
        language: "English",
        publisher: "Beacon Press",
      },
    ];

    const bookIds = [];
    for (const bookData of booksData) {
      const id = await ctx.db.insert("books", {
        ...bookData,
        coverImage: `https://covers.openlibrary.org/b/isbn/${bookData.isbn}-L.jpg`,
        avgRating: 0,
        reviewCount: 0,
      });
      bookIds.push(id);
    }

    // --- 15 Copies distributed across locations ---
    const copyConfigs = [
      { bookIdx: 0, locIdx: 0, condition: "good" as const, ownership: "donated" as const },
      { bookIdx: 0, locIdx: 1, condition: "like_new" as const, ownership: "lent" as const },
      { bookIdx: 1, locIdx: 0, condition: "like_new" as const, ownership: "donated" as const },
      { bookIdx: 1, locIdx: 2, condition: "fair" as const, ownership: "donated" as const },
      { bookIdx: 2, locIdx: 1, condition: "good" as const, ownership: "donated" as const },
      { bookIdx: 2, locIdx: 2, condition: "good" as const, ownership: "lent" as const },
      { bookIdx: 3, locIdx: 0, condition: "like_new" as const, ownership: "donated" as const },
      { bookIdx: 4, locIdx: 1, condition: "good" as const, ownership: "donated" as const },
      { bookIdx: 4, locIdx: 2, condition: "like_new" as const, ownership: "lent" as const },
      { bookIdx: 5, locIdx: 0, condition: "fair" as const, ownership: "donated" as const },
      { bookIdx: 6, locIdx: 1, condition: "good" as const, ownership: "donated" as const },
      { bookIdx: 7, locIdx: 2, condition: "like_new" as const, ownership: "donated" as const },
      { bookIdx: 8, locIdx: 0, condition: "good" as const, ownership: "lent" as const },
      { bookIdx: 8, locIdx: 1, condition: "worn" as const, ownership: "donated" as const },
      { bookIdx: 9, locIdx: 2, condition: "good" as const, ownership: "donated" as const },
    ];

    const copyIds = [];
    for (const cfg of copyConfigs) {
      const id = await ctx.db.insert("copies", {
        bookId: bookIds[cfg.bookIdx],
        status: "available",
        condition: cfg.condition,
        ownershipType: cfg.ownership,
        originalSharerId: seedUserId,
        currentLocationId: locationIds[cfg.locIdx],
        qrCodeUrl: `https://walkingbooks.app/copy/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sharerMaxLendingDays: cfg.ownership === "lent" ? 30 : undefined,
      });
      copyIds.push(id);
    }

    // --- 5 Sample Journey Entries (completed reads) ---
    const now = Date.now();
    const dayMs = DAY_MS;

    const journeyConfigs = [
      { copyIdx: 0, locIdx: 0, daysAgo: 30, readDays: 14 },
      { copyIdx: 2, locIdx: 0, daysAgo: 45, readDays: 21 },
      { copyIdx: 4, locIdx: 1, daysAgo: 20, readDays: 7 },
      { copyIdx: 6, locIdx: 0, daysAgo: 60, readDays: 10 },
      { copyIdx: 10, locIdx: 1, daysAgo: 15, readDays: 18 },
    ];

    for (const j of journeyConfigs) {
      const pickedUpAt = now - j.daysAgo * dayMs;
      const returnedAt = pickedUpAt + j.readDays * dayMs;

      await ctx.db.insert("journeyEntries", {
        copyId: copyIds[j.copyIdx],
        readerId: readerUserId,
        pickupLocationId: locationIds[j.locIdx],
        dropoffLocationId: locationIds[(j.locIdx + 1) % 3],
        pickedUpAt,
        returnedAt,
        conditionAtPickup: "good",
        conditionAtReturn: "good",
        pickupPhotos: [],
        returnPhotos: [],
      });
    }

    // --- Sample Reviews ---
    const reviewsData = [
      { bookIdx: 0, rating: 5, text: "A masterpiece that remains hauntingly relevant. Everyone should read this." },
      { bookIdx: 0, rating: 4, text: "Powerful and unsettling. The world Orwell created feels too close to reality sometimes." },
      { bookIdx: 1, rating: 5, text: "Changed how I think about human history. Brilliantly written and accessible." },
      { bookIdx: 2, rating: 4, text: "A beautiful, inspiring story about following your personal legend." },
      { bookIdx: 4, rating: 5, text: "Practical, actionable advice. I've already started implementing the 1% rule." },
      { bookIdx: 7, rating: 5, text: "Simple yet profound. A book for all ages that reveals deep truths about life." },
      { bookIdx: 8, rating: 4, text: "Epic worldbuilding and complex politics. Slow start but incredibly rewarding." },
      { bookIdx: 9, rating: 5, text: "One of the most important books ever written. Frankl's resilience is awe-inspiring." },
    ];

    for (const r of reviewsData) {
      await ctx.db.insert("reviews", {
        bookId: bookIds[r.bookIdx],
        userId: readerUserId,
        rating: r.rating,
        text: r.text,
      });
    }

    // Update book ratings based on reviews
    const reviewsByBook = new Map<number, { total: number; count: number }>();
    for (const r of reviewsData) {
      const existing = reviewsByBook.get(r.bookIdx) ?? { total: 0, count: 0 };
      existing.total += r.rating;
      existing.count += 1;
      reviewsByBook.set(r.bookIdx, existing);
    }

    for (const [bookIdx, stats] of reviewsByBook) {
      await ctx.db.patch(bookIds[bookIdx], {
        avgRating: Math.round((stats.total / stats.count) * 10) / 10,
        reviewCount: stats.count,
      });
    }

    console.log("[seed] Seed data inserted successfully:");
    console.log(`  - 2 users`);
    console.log(`  - ${locations.length} partner locations`);
    console.log(`  - ${booksData.length} books`);
    console.log(`  - ${copyConfigs.length} copies`);
    console.log(`  - ${journeyConfigs.length} journey entries`);
    console.log(`  - ${reviewsData.length} reviews`);
  },
});
