"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export function FavoriteLocationButton({
  locationId,
  size = "sm",
}: {
  locationId: Id<"partnerLocations">;
  size?: "sm" | "icon";
}) {
  const { isAuthenticated } = useConvexAuth();
  const isFavorited = useQuery(
    api.favoriteLocations.isFavorited,
    isAuthenticated ? { locationId } : "skip",
  );
  const toggle = useMutation(api.favoriteLocations.toggle);

  if (!isAuthenticated) return null;

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const result = await toggle({ locationId });
      toast.success(result.favorited ? "Location saved" : "Location removed");
    } catch {
      toast.error("Could not update favorite");
    }
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleToggle}
      className="h-7 w-7 rounded-lg p-0"
      aria-label={isFavorited ? "Remove from favorites" : "Save location"}
    >
      <Heart
        className={`h-3.5 w-3.5 transition-colors ${
          isFavorited
            ? "fill-red-500 text-red-500"
            : "text-muted-foreground"
        }`}
      />
    </Button>
  );
}
