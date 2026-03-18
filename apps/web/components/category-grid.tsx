import Link from "next/link";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Fiction",
  "Non-Fiction",
  "Science",
  "History",
  "Biography",
  "Self-Help",
  "Technology",
  "Philosophy",
  "Literature",
  "Art",
] as const;

interface CategoryGridProps {
  selectedCategory?: string | null;
}

export function CategoryGrid({ selectedCategory }: CategoryGridProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((category) => (
        <Link
          key={category}
          href={`/browse?category=${encodeURIComponent(category)}`}
          className={cn(
            "rounded-lg border px-3.5 py-1.5 text-[0.8125rem] font-medium transition-all duration-200",
            selectedCategory === category
              ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "border-border/60 bg-card/60 text-foreground hover:border-border hover:bg-card",
          )}
        >
          {category}
        </Link>
      ))}
    </div>
  );
}
