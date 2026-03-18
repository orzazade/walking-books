import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Id } from "@/convex/_generated/dataModel";

interface CopyCardProps {
  copy: {
    _id: Id<"copies">;
    status: string;
    condition: string;
  };
  locationName: string;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700",
  reserved: "bg-amber-100 text-amber-700",
  checked_out: "bg-blue-100 text-blue-700",
  recalled: "bg-orange-100 text-orange-700",
  lost: "bg-red-100 text-red-700",
  damaged: "bg-red-100 text-red-700",
};

export function CopyCard({ copy, locationName }: CopyCardProps) {
  return (
    <Link href={`/copy/${copy._id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between p-4">
          <div className="space-y-1">
            <div className="flex gap-2">
              <Badge className={STATUS_COLORS[copy.status] ?? ""}>{copy.status.replace("_", " ")}</Badge>
              <Badge variant="outline">{copy.condition.replace("_", " ")}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{locationName || "In transit"}</p>
          </div>
          {copy.status === "available" && (
            <span className="text-xs font-medium text-emerald-600">Available for pickup</span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
