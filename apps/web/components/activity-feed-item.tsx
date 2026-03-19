"use client";

import Link from "next/link";
import { Star, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface ActivityFeedItemProps {
  actor: { _id: string; name: string; avatarUrl?: string } | null;
  typeConfig: { icon: LucideIcon; verb: string; color: string; bgColor: string };
  book: { _id: string; title: string; author: string; coverImage?: string };
  detail: {
    locationName?: string;
    rating?: number;
    reviewText?: string;
    previousCondition?: string;
    newCondition?: string;
  };
  timestamp: number;
}

export function ActivityFeedSkeleton({ count = 5 }: { count?: number } = {}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/40 bg-card/60 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="animate-shimmer h-9 w-9 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="animate-shimmer h-4 w-48 rounded-md bg-muted" />
              <div className="animate-shimmer h-3 w-32 rounded-md bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeedItem({ actor, typeConfig, book, detail, timestamp }: ActivityFeedItemProps) {
  const Icon = typeConfig.icon;

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80">
      <div className="flex items-start gap-3">
        {/* Actor avatar */}
        {actor ? (
          <Link href={`/profile/${actor._id}`} className="shrink-0">
            {actor.avatarUrl ? (
              <img
                src={actor.avatarUrl}
                alt={actor.name}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {actor.name.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
            ?
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Action line */}
          <div className="flex items-center gap-2">
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-md ${typeConfig.bgColor}`}
            >
              <Icon className={`h-3 w-3 ${typeConfig.color}`} />
            </div>
            <p className="text-[0.8125rem]">
              {actor ? (
                <Link
                  href={`/profile/${actor._id}`}
                  className="font-medium hover:underline"
                >
                  {actor.name}
                </Link>
              ) : (
                <span className="font-medium">Someone</span>
              )}{" "}
              <span className="text-muted-foreground">
                {typeConfig.verb}
              </span>{" "}
              <Link
                href={`/book/${book._id}`}
                className="font-medium hover:underline"
              >
                {book.title}
              </Link>
            </p>
          </div>

          {/* Book author */}
          <p className="mt-0.5 pl-7 text-[0.75rem] text-muted-foreground">
            by {book.author}
          </p>

          {/* Location (for pickup/return) */}
          {detail.locationName && (
            <p className="mt-1 flex items-center gap-1 pl-7 text-[0.75rem] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {detail.locationName}
            </p>
          )}

          {/* Condition report details */}
          {detail.previousCondition && detail.newCondition && (
            <p className="mt-1 pl-7 text-[0.75rem] text-muted-foreground">
              {detail.previousCondition} → {detail.newCondition}
            </p>
          )}

          {/* Review details */}
          {detail.rating !== undefined && (
            <div className="mt-1.5 pl-7">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star
                    key={s}
                    className={`h-3 w-3 ${
                      s < detail.rating!
                        ? "fill-amber-500 text-amber-500"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              {detail.reviewText && (
                <p className="mt-1 line-clamp-2 text-[0.8125rem] text-muted-foreground">
                  &ldquo;{detail.reviewText}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Timestamp */}
          <p className="mt-1.5 pl-7 text-[0.6875rem] text-muted-foreground/60">
            {timeAgo(timestamp)}
          </p>
        </div>

        {/* Book cover thumbnail */}
        {book.coverImage && (
          <Link
            href={`/book/${book._id}`}
            className="hidden shrink-0 sm:block"
          >
            <img
              src={book.coverImage}
              alt={book.title}
              className="h-16 w-11 rounded-md object-cover"
            />
          </Link>
        )}
      </div>
    </div>
  );
}
