"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import Link from "next/link";

export function FriendsReadingSection() {
  const { isAuthenticated } = useConvexAuth();
  const friendsReading = useQuery(
    api.follows.friendsReading,
    isAuthenticated ? {} : "skip",
  );

  if (!friendsReading || friendsReading.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
        <Users className="h-4.5 w-4.5 text-primary" />
        Friends Currently Reading
      </h2>
      <div className="space-y-2">
        {friendsReading.map((item) => (
          <div
            key={`${item.userId}-${item.bookId}`}
            className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-3"
          >
            {/* Book cover */}
            <Link href={`/book/${item.bookId}`} className="shrink-0">
              <div className="h-14 w-10 overflow-hidden rounded-md border border-border/30 bg-muted">
                {item.coverImage ? (
                  <img
                    src={item.coverImage}
                    alt={item.bookTitle}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[0.5rem] text-muted-foreground">
                    No cover
                  </div>
                )}
              </div>
            </Link>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <Link
                href={`/book/${item.bookId}`}
                className="block truncate text-sm font-medium hover:underline"
              >
                {item.bookTitle}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {item.bookAuthor}
              </p>
            </div>

            {/* Reader avatar + name */}
            <Link
              href={`/profile/${item.userId}`}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-muted"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={item.avatarUrl} alt={item.userName} />
                <AvatarFallback className="text-[0.625rem]">
                  {item.userName?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {item.userName}
              </span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
