import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  icon: Icon,
  label,
  value,
  iconClassName = "text-primary",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center p-4">
        <Icon className={`h-5 w-5 ${iconClassName}`} />
        <span className="mt-1 text-xs text-muted-foreground">{label}</span>
        <span className="text-lg font-bold">{value}</span>
      </CardContent>
    </Card>
  );
}
