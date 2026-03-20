import { v } from "convex/values";

export type Condition = "like_new" | "good" | "fair" | "worn";

export const CONDITIONS: Condition[] = ["like_new", "good", "fair", "worn"];

export const CONDITION_LABELS: Record<Condition, string> = {
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
};

export const conditionValidator = v.union(
  v.literal("like_new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("worn"),
);

export type OwnershipType = "donated" | "lent";

export const ownershipTypeValidator = v.union(
  v.literal("donated"),
  v.literal("lent"),
);

export type ReportType = "pickup_check" | "return_check" | "damage_report";

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  pickup_check: "Pickup Check",
  return_check: "Return Check",
  damage_report: "Damage Report",
};

export const reportTypeValidator = v.union(
  v.literal("pickup_check"),
  v.literal("return_check"),
  v.literal("damage_report"),
);

export type UserStatus = "active" | "restricted" | "banned";

export const userStatusValidator = v.union(
  v.literal("active"),
  v.literal("restricted"),
  v.literal("banned"),
);

export type CopyStatus = "available" | "reserved" | "checked_out" | "lost" | "damaged" | "recalled";

export const COPY_STATUS_LABELS: Record<CopyStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  checked_out: "Checked Out",
  lost: "Lost",
  damaged: "Damaged",
  recalled: "Recalled",
};

export const copyStatusValidator = v.union(
  v.literal("available"),
  v.literal("reserved"),
  v.literal("checked_out"),
  v.literal("lost"),
  v.literal("damaged"),
  v.literal("recalled"),
);

export const reservationStatusValidator = v.union(
  v.literal("active"),
  v.literal("fulfilled"),
  v.literal("expired"),
  v.literal("cancelled"),
);

export const waitlistStatusValidator = v.union(
  v.literal("waiting"),
  v.literal("notified"),
  v.literal("fulfilled"),
  v.literal("cancelled"),
);

export const readingProgressStatusValidator = v.union(
  v.literal("reading"),
  v.literal("finished"),
  v.literal("abandoned"),
);

export type NotificationType =
  | "reservation_confirmed"
  | "reservation_expired"
  | "book_picked_up"
  | "book_returned"
  | "book_recalled"
  | "waitlist_notified"
  | "waitlist_available"
  | "wishlist_available"
  | "reputation_milestone"
  | "achievement_unlocked"
  | "book_request_fulfilled";

export const notificationTypeValidator = v.union(
  v.literal("reservation_confirmed"),
  v.literal("reservation_expired"),
  v.literal("book_picked_up"),
  v.literal("book_returned"),
  v.literal("book_recalled"),
  v.literal("waitlist_notified"),
  v.literal("waitlist_available"),
  v.literal("wishlist_available"),
  v.literal("reputation_milestone"),
  v.literal("achievement_unlocked"),
  v.literal("book_request_fulfilled"),
);

export type EventType = "reading_meetup" | "author_visit" | "book_club" | "workshop" | "other";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  reading_meetup: "Reading Meetup",
  author_visit: "Author Visit",
  book_club: "Book Club",
  workshop: "Workshop",
  other: "Other",
};

export const eventTypeValidator = v.union(
  v.literal("reading_meetup"),
  v.literal("author_visit"),
  v.literal("book_club"),
  v.literal("workshop"),
  v.literal("other"),
);

export const bookRequestStatusValidator = v.union(
  v.literal("open"),
  v.literal("fulfilled"),
  v.literal("cancelled"),
);

/** Validate a photos array — shared by copies, conditionReports, and partnerLocations. */
export function validatePhotos(photos: string[]): void {
  if (photos.length > 20)
    throw new Error("Maximum 20 photos allowed");
  for (const url of photos) {
    if (url.length > 2000)
      throw new Error("Each photo URL must be 2000 characters or less");
  }
}
