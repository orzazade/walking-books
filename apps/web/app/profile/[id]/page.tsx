"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useConvexAuth, Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { type Condition, CONDITION_LABELS } from "@/convex/lib/validators";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BookOpen,
  Share2,
  Users,
  UserPlus,
  UserMinus,
  Award,
} from "lucide-react";
import { useState } from "react";

export default function ProfilePage() {
  const params = useParams();
  const userId = params.id as Id<"users">;

  const profile = useQuery(api.users.profile, { userId });
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.users.currentUser,
    isAuthenticated ? {} : "skip",
  );
  const followersList = useQuery(api.follows.followers, { userId });
  const followingList = useQuery(api.follows.following, { userId });
  const isFollowing = useQuery(api.follows.isFollowing, {
    targetUserId: userId,
  });
  const journeyEntries = useQuery(api.journeyEntries.byReader, {
    readerId: userId,
  });

  const toggleFollow = useMutation(api.follows.toggle);
  const [toggling, setToggling] = useState(false);

  if (profile === undefined) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="animate-shimmer h-24 w-24 rounded-full bg-muted" />
          <div className="flex-1 space-y-3">
            <div className="animate-shimmer h-7 w-48 rounded-lg bg-muted" />
            <div className="animate-shimmer h-4 w-32 rounded-lg bg-muted" />
          </div>
        </div>
      </main>
    );
  }

  if (profile === null) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
          <h2 className="font-serif text-lg font-semibold">User not found</h2>
          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
            This profile may no longer exist.
          </p>
        </div>
      </main>
    );
  }

  const isOwnProfile = currentUser?._id === userId;

  const repBadge =
    profile.reputationScore >= 80
      ? {
          label: "Trusted Reader",
          color:
            "bg-primary/10 text-primary",
        }
      : profile.reputationScore >= 50
        ? {
            label: "Good Standing",
            color:
              "bg-blue-500/10 text-blue-700 dark:text-blue-400",
          }
        : {
            label: "New Reader",
            color:
              "bg-secondary text-secondary-foreground",
          };

  async function handleToggleFollow() {
    setToggling(true);
    try {
      await toggleFollow({ targetUserId: userId });
    } finally {
      setToggling(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <Avatar className="h-24 w-24 border-2 border-border/40">
          <AvatarImage src={profile.avatarUrl} alt={profile.name} />
          <AvatarFallback className="font-serif text-2xl">
            {profile.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 text-center sm:text-left">
          <h1 className="font-serif text-[1.5rem] font-semibold tracking-[-0.01em]">
            {profile.name}
          </h1>
          {profile.bio && (
            <p className="mt-1 text-[0.875rem] text-muted-foreground">
              {profile.bio}
            </p>
          )}
          <div className="mt-2.5 flex items-center justify-center gap-2 sm:justify-start">
            <span
              className={`rounded-md px-2 py-0.5 text-[0.6875rem] font-medium ${repBadge.color}`}
            >
              {repBadge.label}
            </span>
            <Badge
              variant="secondary"
              className="gap-1 rounded-md text-[0.6875rem]"
            >
              <Award className="h-3 w-3" />
              {profile.reputationScore} rep
            </Badge>
          </div>

          {profile.favoriteGenres.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {profile.favoriteGenres.map((g) => (
                <Badge
                  key={g}
                  variant="outline"
                  className="rounded-md text-[0.6875rem]"
                >
                  {g}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {!isOwnProfile && (
          <Authenticated>
            <Button
              variant={isFollowing ? "outline" : "default"}
              onClick={handleToggleFollow}
              disabled={toggling}
              className="gap-1.5 rounded-lg text-[0.8125rem]"
            >
              {isFollowing ? (
                <>
                  <UserMinus className="h-3.5 w-3.5" /> Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" /> Follow
                </>
              )}
            </Button>
          </Authenticated>
        )}
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            icon: BookOpen,
            value: profile.booksRead,
            label: "Read",
          },
          {
            icon: Share2,
            value: profile.booksShared,
            label: "Shared",
          },
          {
            icon: Users,
            value: followersList?.length ?? 0,
            label: "Followers",
          },
          {
            icon: Users,
            value: followingList?.length ?? 0,
            label: "Following",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center rounded-xl border border-border/40 bg-card/60 p-4"
          >
            <stat.icon className="h-4 w-4 text-primary" />
            <span className="mt-1.5 font-serif text-xl font-semibold">
              {stat.value}
            </span>
            <span className="text-[0.6875rem] text-muted-foreground">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="editorial-divider my-8">
        <div className="botanical-ornament" />
      </div>

      {/* Recent Activity */}
      <section>
        <div className="mb-4">
          <div className="section-kicker mb-2">Activity</div>
          <h2 className="font-serif text-[1.25rem] font-semibold">
            Recent Activity
          </h2>
        </div>
        {journeyEntries === undefined ? (
          <div className="space-y-2">
            <div className="animate-shimmer h-16 rounded-xl bg-muted" />
            <div className="animate-shimmer h-16 rounded-xl bg-muted" />
          </div>
        ) : journeyEntries.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-10 text-center text-[0.8125rem] text-muted-foreground">
            No reading activity yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {journeyEntries
              .slice(-10)
              .reverse()
              .map((entry) => (
                <div
                  key={entry._id}
                  className="rounded-xl border border-border/40 bg-card/60 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[0.8125rem] font-medium">
                        {entry.returnedAt ? "Returned" : "Picked up"} a book
                      </p>
                      <p className="text-[0.75rem] text-muted-foreground">
                        {new Date(
                          entry.returnedAt ?? entry.pickedUpAt,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-md text-[0.6875rem]"
                    >
                      {CONDITION_LABELS[(entry.conditionAtReturn ?? entry.conditionAtPickup) as Condition]}
                    </Badge>
                  </div>
                  {entry.readerNote && (
                    <p className="mt-2 font-serif text-[0.8125rem] italic text-muted-foreground">
                      &ldquo;{entry.readerNote}&rdquo;
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}
      </section>
    </main>
  );
}
