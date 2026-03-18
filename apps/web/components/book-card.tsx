import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { type Id } from "@/convex/_generated/dataModel";
import { Star } from "lucide-react";

interface BookCardProps {
  book: {
    _id: Id<"books">;
    title: string;
    author: string;
    coverImage: string;
    avgRating: number;
    reviewCount: number;
    categories: string[];
    availableCopies: number;
    totalCopies: number;
  };
}

export function BookCard({ book }: BookCardProps) {
  const available = book.availableCopies > 0;

  return (
    <Link href={`/book/${book._id}`} className="group block">
      <article className="relative overflow-hidden rounded-2xl border border-border/50 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-lg hover:shadow-primary/[0.06]">
        {/* Book spine accent */}
        <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-2xl bg-gradient-to-b from-primary via-primary/50 to-accent/60 opacity-50 transition-opacity duration-300 group-hover:opacity-90" />

        {/* Cover */}
        <div className="aspect-[2/3] overflow-hidden bg-muted">
          {book.coverImage ? (
            <img
              src={book.coverImage}
              alt={book.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted to-secondary">
              <div className="font-serif text-4xl text-muted-foreground/40">
                W
              </div>
              <div className="max-w-[70%] text-center text-xs text-muted-foreground/50">
                {book.title}
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-2.5 p-4 pl-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-2 font-serif text-[0.9375rem] font-semibold leading-snug">
                {book.title}
              </h3>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                {book.author}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {book.categories.slice(0, 2).map((category) => (
              <span
                key={category}
                className="rounded-md bg-secondary px-2 py-0.5 text-[0.6875rem] font-medium text-secondary-foreground"
              >
                {category}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border/40 pt-2.5 text-[0.8125rem]">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>
                {book.reviewCount > 0
                  ? `${book.avgRating}`
                  : "New"}
              </span>
            </div>
            <Badge
              variant={available ? "default" : "secondary"}
              className="h-5 rounded-md px-1.5 text-[0.625rem] font-semibold"
            >
              {available
                ? `${book.availableCopies} available`
                : "Unavailable"}
            </Badge>
          </div>
        </div>
      </article>
    </Link>
  );
}
