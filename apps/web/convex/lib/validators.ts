import { v } from "convex/values";

export type Condition = "like_new" | "good" | "fair" | "worn";

export const conditionValidator = v.union(
  v.literal("like_new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("worn"),
);
