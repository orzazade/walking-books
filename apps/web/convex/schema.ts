import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    status: v.union(
      v.literal("available"),
      v.literal("reserved"),
      v.literal("checked_out"),
      v.literal("lost"),
      v.literal("damaged"),
      v.literal("recalled"),
    ),
    condition: v.union(
      v.literal("like_new"),
      v.literal("good"),
      v.literal("fair"),
      v.literal("worn"),
    ),
    ownershipType: v.union(v.literal("donated"), v.literal("lent")),
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
    conditionAtPickup: v.string(),
    conditionAtReturn: v.optional(v.string()),
    pickupPhotos: v.array(v.string()),
    returnPhotos: v.array(v.string()),
    readerNote: v.optional(v.string()),
    reservationId: v.optional(v.id("reservations")),
  })
    .index("by_copy", ["copyId"])
    .index("by_reader", ["readerId"]),

  users: defineTable({
    clerkId: v.string(),
    phone: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    roles: v.array(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("restricted"),
      v.literal("banned"),
    ),
    reputationScore: v.number(),
    booksShared: v.number(),
    booksRead: v.number(),
    favoriteGenres: v.array(v.string()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_phone", ["phone"]),

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
  })
    .index("by_manager", ["managedByUserId"]),

  reservations: defineTable({
    copyId: v.id("copies"),
    userId: v.id("users"),
    locationId: v.id("partnerLocations"),
    reservedAt: v.number(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("fulfilled"),
      v.literal("expired"),
      v.literal("cancelled"),
    ),
  })
    .index("by_copy", ["copyId", "status"])
    .index("by_user", ["userId", "status"])
    .index("by_expiry", ["status", "expiresAt"]),

  conditionReports: defineTable({
    copyId: v.id("copies"),
    reportedByUserId: v.optional(v.id("users")),
    reportedByPartnerId: v.optional(v.id("partnerLocations")),
    type: v.union(
      v.literal("pickup_check"),
      v.literal("return_check"),
      v.literal("damage_report"),
    ),
    photos: v.array(v.string()),
    description: v.string(),
    previousCondition: v.string(),
    newCondition: v.string(),
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
    .index("by_user_book", ["userId", "bookId"]),

  follows: defineTable({
    followerId: v.id("users"),
    followingId: v.id("users"),
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_pair", ["followerId", "followingId"]),

  wishlist: defineTable({
    userId: v.id("users"),
    bookId: v.id("books"),
    addedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_book", ["userId", "bookId"]),
});
