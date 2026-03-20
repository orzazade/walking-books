import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { bookRequestStatusValidator, conditionValidator, copyStatusValidator, eventTypeValidator, notificationTypeValidator, ownershipTypeValidator, readingProgressStatusValidator, reportTypeValidator, reservationStatusValidator, transferRequestStatusValidator, userStatusValidator, waitlistStatusValidator } from "./lib/validators";

export default defineSchema({
  books: defineTable({
    title: v.string(),
    author: v.string(),
    isbn: v.optional(v.string()),
    coverImage: v.string(),
    description: v.string(),
    categories: v.array(v.string()),
    pageCount: v.number(),
    language: v.string(),
    publisher: v.optional(v.string()),
    avgRating: v.number(),
    reviewCount: v.number(),
  })
    .index("by_isbn", ["isbn"])
    .searchIndex("search_title_author", {
      searchField: "title",
      filterFields: ["categories", "language"],
    }),

  copies: defineTable({
    bookId: v.id("books"),
    status: copyStatusValidator,
    condition: conditionValidator,
    ownershipType: ownershipTypeValidator,
    originalSharerId: v.id("users"),
    currentLocationId: v.optional(v.id("partnerLocations")),
    currentHolderId: v.optional(v.id("users")),
    qrCodeUrl: v.string(),
    returnDeadline: v.optional(v.number()),
    lendingPeriodDays: v.optional(v.number()),
    sharerMaxLendingDays: v.optional(v.number()),
  })
    .index("by_book", ["bookId"])
    .index("by_location", ["currentLocationId", "status"])
    .index("by_holder", ["currentHolderId"])
    .index("by_sharer", ["originalSharerId"])
    .index("by_status_deadline", ["status", "returnDeadline"]),

  journeyEntries: defineTable({
    copyId: v.id("copies"),
    readerId: v.id("users"),
    pickupLocationId: v.id("partnerLocations"),
    dropoffLocationId: v.optional(v.id("partnerLocations")),
    pickedUpAt: v.number(),
    returnedAt: v.optional(v.number()),
    conditionAtPickup: conditionValidator,
    conditionAtReturn: v.optional(conditionValidator),
    pickupPhotos: v.array(v.string()),
    returnPhotos: v.array(v.string()),
    readerNote: v.optional(v.string()),
    reservationId: v.optional(v.id("reservations")),
  })
    .index("by_copy", ["copyId"])
    .index("by_reader", ["readerId"])
    .index("by_pickedUpAt", ["pickedUpAt"])
    .index("by_returnedAt", ["returnedAt"]),

  users: defineTable({
    clerkId: v.string(),
    phone: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    roles: v.array(v.string()),
    status: userStatusValidator,
    reputationScore: v.number(),
    booksShared: v.number(),
    booksRead: v.number(),
    favoriteGenres: v.array(v.string()),
  })
    .index("by_clerk_id", ["clerkId"]),

  partnerLocations: defineTable({
    name: v.string(),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    contactPhone: v.string(),
    contactEmail: v.optional(v.string()),
    operatingHours: v.any(),
    photos: v.array(v.string()),
    shelfCapacity: v.number(),
    currentBookCount: v.number(),
    managedByUserId: v.id("users"),
    staffUserIds: v.array(v.id("users")),
    avgRating: v.number(),
    reviewCount: v.number(),
  })
    .index("by_manager", ["managedByUserId"]),

  locationReviews: defineTable({
    locationId: v.id("partnerLocations"),
    userId: v.id("users"),
    rating: v.number(),
    text: v.string(),
  })
    .index("by_location", ["locationId"])
    .index("by_user", ["userId"])
    .index("by_user_location", ["userId", "locationId"]),

  reservations: defineTable({
    copyId: v.id("copies"),
    userId: v.id("users"),
    locationId: v.id("partnerLocations"),
    reservedAt: v.number(),
    expiresAt: v.number(),
    status: reservationStatusValidator,
  })
    .index("by_copy", ["copyId", "status"])
    .index("by_user", ["userId", "status"])
    .index("by_location", ["locationId", "status"])
    .index("by_expiry", ["status", "expiresAt"]),

  conditionReports: defineTable({
    copyId: v.id("copies"),
    reportedByUserId: v.optional(v.id("users")),
    reportedByPartnerId: v.optional(v.id("partnerLocations")),
    type: reportTypeValidator,
    photos: v.array(v.string()),
    description: v.string(),
    previousCondition: conditionValidator,
    newCondition: conditionValidator,
    createdAt: v.number(),
  })
    .index("by_copy", ["copyId"]),

  reviews: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    rating: v.number(),
    text: v.string(),
  })
    .index("by_book", ["bookId"])
    .index("by_user", ["userId"])
    .index("by_user_book", ["userId", "bookId"]),

  follows: defineTable({
    followerId: v.id("users"),
    followingId: v.id("users"),
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_pair", ["followerId", "followingId"]),

  readingGoals: defineTable({
    userId: v.id("users"),
    year: v.number(),
    targetBooks: v.number(),
    month: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_year", ["userId", "year"])
    .index("by_user_year_month", ["userId", "year", "month"]),

  wishlist: defineTable({
    userId: v.id("users"),
    bookId: v.id("books"),
    addedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_book", ["userId", "bookId"])
    .index("by_book", ["bookId"]),

  collections: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_public", ["isPublic", "createdAt"]),

  collectionItems: defineTable({
    collectionId: v.id("collections"),
    bookId: v.id("books"),
    addedAt: v.number(),
  })
    .index("by_collection", ["collectionId"])
    .index("by_collection_book", ["collectionId", "bookId"]),

  collectionFollows: defineTable({
    followerId: v.id("users"),
    collectionId: v.id("collections"),
    followedAt: v.number(),
  })
    .index("by_follower", ["followerId"])
    .index("by_collection", ["collectionId"])
    .index("by_pair", ["followerId", "collectionId"]),

  bookNotes: defineTable({
    userId: v.id("users"),
    bookId: v.id("books"),
    content: v.string(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_book", ["userId", "bookId"]),

  waitlist: defineTable({
    userId: v.id("users"),
    bookId: v.id("books"),
    status: waitlistStatusValidator,
    joinedAt: v.number(),
    notifiedAt: v.optional(v.number()),
    notifiedCopyId: v.optional(v.id("copies")),
  })
    .index("by_book_status", ["bookId", "status", "joinedAt"])
    .index("by_user_book", ["userId", "bookId"])
    .index("by_user", ["userId"]),

  bookRequests: defineTable({
    userId: v.id("users"),
    title: v.string(),
    author: v.optional(v.string()),
    note: v.optional(v.string()),
    status: bookRequestStatusValidator,
    createdAt: v.number(),
    fulfilledBy: v.optional(v.id("users")),
    fulfilledAt: v.optional(v.number()),
  })
    .index("by_status", ["status", "createdAt"])
    .index("by_user", ["userId"]),

  reviewVotes: defineTable({
    reviewId: v.id("reviews"),
    userId: v.id("users"),
    helpful: v.boolean(),
  })
    .index("by_review", ["reviewId"])
    .index("by_user_review", ["userId", "reviewId"]),

  readingStreaks: defineTable({
    userId: v.id("users"),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastActiveDate: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_lastActiveDate", ["lastActiveDate"]),

  userNotifications: defineTable({
    userId: v.id("users"),
    type: notificationTypeValidator,
    title: v.string(),
    message: v.string(),
    relatedBookId: v.optional(v.id("books")),
    relatedCopyId: v.optional(v.id("copies")),
    relatedLocationId: v.optional(v.id("partnerLocations")),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_read", ["userId", "read", "createdAt"]),

  notificationPreferences: defineTable({
    userId: v.id("users"),
    reservation_confirmed: v.boolean(),
    reservation_expired: v.boolean(),
    book_picked_up: v.boolean(),
    book_returned: v.boolean(),
    book_recalled: v.boolean(),
    waitlist_notified: v.boolean(),
    waitlist_available: v.boolean(),
    reputation_milestone: v.boolean(),
    achievement_unlocked: v.boolean(),
    wishlist_available: v.boolean(),
    book_request_fulfilled: v.boolean(),
    transfer_accepted: v.boolean(),
  })
    .index("by_user", ["userId"]),

  readingProgress: defineTable({
    userId: v.id("users"),
    copyId: v.id("copies"),
    bookId: v.id("books"),
    currentPage: v.number(),
    totalPages: v.number(),
    status: readingProgressStatusValidator,
    startedAt: v.number(),
    lastUpdatedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_copy", ["userId", "copyId"])
    .index("by_user_status", ["userId", "status"]),

  locationEvents: defineTable({
    locationId: v.id("partnerLocations"),
    createdByUserId: v.id("users"),
    title: v.string(),
    description: v.string(),
    eventType: eventTypeValidator,
    startsAt: v.number(),
    endsAt: v.number(),
    capacity: v.optional(v.number()),
    rsvpCount: v.number(),
  })
    .index("by_location", ["locationId", "startsAt"])
    .index("by_starts_at", ["startsAt"]),

  eventRsvps: defineTable({
    eventId: v.id("locationEvents"),
    userId: v.id("users"),
    rsvpedAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_user", ["userId"])
    .index("by_pair", ["userId", "eventId"]),

  favoriteLocations: defineTable({
    userId: v.id("users"),
    locationId: v.id("partnerLocations"),
    favoritedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_location", ["userId", "locationId"]),

  transferRequests: defineTable({
    copyId: v.id("copies"),
    bookId: v.id("books"),
    requesterId: v.id("users"),
    fromLocationId: v.id("partnerLocations"),
    toLocationId: v.id("partnerLocations"),
    status: transferRequestStatusValidator,
    note: v.optional(v.string()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_copy", ["copyId", "status"])
    .index("by_requester", ["requesterId", "status"])
    .index("by_from_location", ["fromLocationId", "status"])
    .index("by_to_location", ["toLocationId", "status"]),
});
