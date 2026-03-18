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
