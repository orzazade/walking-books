import { type UserStatus } from "@/convex/lib/validators";

export const USER_STATUS_BADGE: Record<UserStatus, "default" | "secondary" | "destructive"> = {
  active: "default",
  restricted: "secondary",
  banned: "destructive",
};

export function repColor(score: number) {
  if (score >= 70) return "text-green-600";
  if (score >= 30) return "text-amber-600";
  return "text-destructive";
}
