"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useConvexAuth, Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/utils";
import { ProfileActivitySection } from "@/components/profile-activity-section";
import { ProfileReviewsSection } from "@/components/profile-reviews-section";
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
  Flame,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_FALLBACK_ICON } from "@/lib/achievements";

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
  const achievements = useQuery(api.achievements.forUser, { userId });
  const streak = useQuery(api.readingStreaks.forUser, { userId });

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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update follow status"));
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

      {/* Reading Streak */}
      {streak !== undefined && streak !== null && (streak.currentStreak > 0 || streak.longestStreak > 0) && (
        <div className="mt-8 rounded-xl border border-border/40 bg-card/60 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Flame className={`h-4 w-4 ${streak.currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
            <h2 className="font-serif text-[1rem] font-semibold">Reading Streak</h2>
          </div>
          <div className="flex gap-6">
            <div>
              <span className="font-serif text-[1.5rem] font-semibold">{streak.currentStreak}</span>
              <span className="ml-1.5 text-[0.75rem] text-muted-foreground">
                {streak.currentStreak === 1 ? "day" : "days"} current
              </span>
            </div>
            <div>
              <span className="font-serif text-[1.5rem] font-semibold">{streak.longestStreak}</span>
              <span className="ml-1.5 text-[0.75rem] text-muted-foreground">
                {streak.longestStreak === 1 ? "day" : "days"} longest
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievements !== undefined && achievements.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="font-serif text-[1rem] font-semibold">
              Achievements
            </h2>
            <span className="text-[0.75rem] text-muted-foreground">
              {achievements.length} unlocked
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {achievements.map((a) => {
              const Icon = ACHIEVEMENT_ICONS[a.key] ?? ACHIEVEMENT_FALLBACK_ICON;
              return (
                <div
                  key={a.key}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 transition-colors hover:bg-amber-500/10"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                      <Icon className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-[0.8125rem] font-medium">{a.name}</h3>
                      <p className="text-[0.6875rem] text-muted-foreground">
                        {a.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="mt-8">
        <ProfileReviewsSection userId={userId} />
      </div>

      {/* Divider */}
      <div className="editorial-divider my-8">
        <div className="botanical-ornament" />
      </div>

      {/* Recent Activity */}
      <ProfileActivitySection userId={userId} />
    </main>
  );
}
