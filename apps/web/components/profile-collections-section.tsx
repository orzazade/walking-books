"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Library, BookOpen, Users } from "lucide-react";
import Link from "next/link";

export function ProfileCollectionsSection({
  userId,
}: {
  userId: Id<"users">;
}) {
  const collections = useQuery(api.collections.byUser, { userId });

  if (!collections || collections.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-[1.125rem] font-semibold">
        <Library className="h-4.5 w-4.5 text-primary" />
        Collections
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {collections.map((collection) => (
          <Link
            key={collection._id}
            href={`/collections/${collection._id}`}
            className="group rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
          >
            <h3 className="font-serif text-sm font-semibold group-hover:underline">
              {collection.name}
            </h3>
            {collection.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {collection.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-[0.6875rem] text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {collection.bookCount} book{collection.bookCount !== 1 ? "s" : ""}
              </span>
              {collection.followerCount > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {collection.followerCount} follower{collection.followerCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
