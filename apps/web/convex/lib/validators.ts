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
