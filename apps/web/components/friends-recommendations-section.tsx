"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Star } from "lucide-react";
import Link from "next/link";

export function FriendsRecommendationsSection() {
  const { isAuthenticated } = useConvexAuth();
  const recommendations = useQuery(
    api.reviews.friendsRecommendations,
    isAuthenticated ? {} : "skip",
  );

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
        <Heart className="h-4.5 w-4.5 text-primary" />
        Loved by Friends
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {recommendations.map((item) => (
          <Link
            key={`${item.bookId}-${item.reviewerId}`}
            href={`/book/${item.bookId}`}
            className="group shrink-0"
          >
            <div className="w-[130px] overflow-hidden rounded-xl border border-border/40 bg-card/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-border">
              {/* Cover */}
              <div className="aspect-[2/3] overflow-hidden bg-muted">
                {item.coverImage ? (
                  <img
                    src={item.coverImage}
                    alt={item.bookTitle}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[0.5rem] text-muted-foreground">
                    No cover
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-2.5">
                <p className="truncate text-[0.75rem] font-medium">
                  {item.bookTitle}
                </p>
                <p className="truncate text-[0.6875rem] text-muted-foreground">
                  {item.bookAuthor}
                </p>
                {/* Rating */}
                <div className="mt-1.5 flex items-center gap-0.5">
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-2.5 w-2.5 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                {/* Reviewer */}
                <div className="mt-1.5 flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage
                      src={item.reviewerAvatarUrl}
                      alt={item.reviewerName}
                    />
                    <AvatarFallback className="text-[0.4375rem]">
                      {item.reviewerName?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-[0.625rem] text-muted-foreground">
                    {item.reviewerName}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
