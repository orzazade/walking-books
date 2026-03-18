import { Badge } from "@/components/ui/badge";

interface ReputationBadgeProps {
  score: number;
}

export function ReputationBadge({ score }: ReputationBadgeProps) {
  const variant = score > 50 ? "default" : score >= 30 ? "secondary" : "destructive";
  const color =
    score > 50
      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
      : score >= 30
        ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
        : "bg-red-100 text-red-700 hover:bg-red-100";

  return (
    <Badge variant={variant} className={color}>
      Rep: {score}
    </Badge>
  );
}
