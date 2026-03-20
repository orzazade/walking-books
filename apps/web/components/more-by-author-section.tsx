"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Star } from "lucide-react";
import Link from "next/link";

export function MoreByAuthorSection({
  bookId,
  authorName,
}: {
  bookId: Id<"books">;
  authorName: string;
}) {
  const books = useQuery(api.books.byAuthor, { bookId });

  if (!books || books.length === 0) return null;

  return (
    <>
      <div className="editorial-divider my-10">
        <div className="botanical-ornament" />
      </div>

      <section>
        <div className="mb-4">
          <div className="section-kicker mb-2">Author</div>
          <h2 className="font-serif text-[1.25rem] font-semibold">
            More by {authorName}
          </h2>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {books.map((rec) => (
            <Link
              key={rec._id}
              href={`/book/${rec._id}`}
              className="group block w-36 shrink-0"
            >
              <div className="aspect-[2/3] overflow-hidden rounded-xl border border-border/40 bg-muted transition-all duration-300 group-hover:-translate-y-1 group-hover:border-border group-hover:shadow-md">
                {rec.coverImage ? (
                  <img
                    src={rec.coverImage}
                    alt={rec.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-secondary">
                    <div className="font-serif text-2xl text-muted-foreground/40">
                      W
                    </div>
                    <div className="max-w-[80%] text-center text-[0.625rem] text-muted-foreground/50">
                      {rec.title}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-0.5">
                <h3 className="line-clamp-2 text-[0.8125rem] font-medium leading-snug">
                  {rec.title}
                </h3>
                <div className="flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
                  {rec.avgRating > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {rec.avgRating.toFixed(1)}
                    </span>
                  )}
                </div>
                {rec.availableCopies > 0 && (
                  <span className="text-[0.625rem] font-medium text-primary">
                    {rec.availableCopies} available
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
