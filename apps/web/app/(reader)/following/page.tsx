"use client";

import Link from "next/link";
import { useQuery, useMutation, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";
import { HeaderActionLink } from "@/components/header-action-link";
import {
  Users,
  UserMinus,
  Search,
  BookOpen,
  Share2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Tab = "following" | "followers";

function UserCard({
  user,
  showUnfollow,
  onUnfollow,
  unfollowLoading,
}: {
  user: {
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
    bio?: string;
    booksRead: number;
    booksShared: number;
    reputationScore: number;
    favoriteGenres: string[];
  };
  showUnfollow: boolean;
  onUnfollow: (userId: Id<"users">) => void;
  unfollowLoading: string | null;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border/40 bg-card/60 p-4">
      <Link href={`/profile/${user._id}`}>
        <Avatar className="h-12 w-12 border border-border/40">
          <AvatarImage src={user.avatarUrl} alt={user.name} />
          <AvatarFallback className="font-serif text-sm">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/profile/${user._id}`}
              className="font-serif text-[0.9375rem] font-semibold hover:underline"
            >
              {user.name}
            </Link>
            {user.bio && (
              <p className="mt-0.5 line-clamp-1 text-[0.8125rem] text-muted-foreground">
                {user.bio}
              </p>
            )}
          </div>

          {showUnfollow && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUnfollow(user._id)}
              disabled={unfollowLoading === user._id}
              className="shrink-0 gap-1.5 text-[0.75rem]"
            >
              <UserMinus className="h-3.5 w-3.5" />
              Unfollow
            </Button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.75rem] text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {user.booksRead} read
          </span>
          <span className="flex items-center gap-1">
            <Share2 className="h-3 w-3" />
            {user.booksShared} shared
          </span>
        </div>

        {user.favoriteGenres.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {user.favoriteGenres.slice(0, 4).map((g) => (
              <Badge
                key={g}
                variant="outline"
                className="rounded-md text-[0.6875rem]"
              >
                {g}
              </Badge>
            ))}
            {user.favoriteGenres.length > 4 && (
              <Badge variant="outline" className="rounded-md text-[0.6875rem]">
                +{user.favoriteGenres.length - 4}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FollowingContent() {
  const { isAuthenticated } = useConvexAuth();
  const followingList = useQuery(
    api.follows.myFollowingEnriched,
    isAuthenticated ? {} : "skip",
  );
  const followersList = useQuery(
    api.follows.myFollowersEnriched,
    isAuthenticated ? {} : "skip",
  );
  const toggleFollow = useMutation(api.follows.toggle);

  const [activeTab, setActiveTab] = useState<Tab>("following");
  const [unfollowLoading, setUnfollowLoading] = useState<string | null>(null);

  async function handleUnfollow(userId: Id<"users">) {
    setUnfollowLoading(userId);
    try {
      await toggleFollow({ targetUserId: userId });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to unfollow"));
    } finally {
      setUnfollowLoading(null);
    }
  }

  const isLoading = followingList === undefined || followersList === undefined;
  const list = activeTab === "following" ? followingList : followersList;

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-border/40 bg-card/60 p-4"
          >
            <div className="animate-shimmer h-12 w-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="animate-shimmer h-4 w-32 rounded-md bg-muted" />
              <div className="animate-shimmer h-3 w-48 rounded-md bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border/40 bg-muted/50 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("following")}
          className={`flex-1 rounded-md px-4 py-2 text-[0.8125rem] font-medium transition-colors ${
            activeTab === "following"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Following ({followingList?.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("followers")}
          className={`flex-1 rounded-md px-4 py-2 text-[0.8125rem] font-medium transition-colors ${
            activeTab === "followers"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Followers ({followersList?.length ?? 0})
        </button>
      </div>

      {/* List */}
      {list && list.length > 0 ? (
        <div className="space-y-2">
          {list.map((user) => (
            <UserCard
              key={user._id}
              user={user}
              showUnfollow={activeTab === "following"}
              onUnfollow={handleUnfollow}
              unfollowLoading={unfollowLoading}
            />
          ))}
        </div>
      ) : activeTab === "following" ? (
        <EmptyState
          icon={Users}
          title="Not following anyone"
          message="Find readers with similar taste and follow them to see their activity."
        >
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/search"
              className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
            >
              Find readers
            </Link>
          </div>
        </EmptyState>
      ) : (
        <EmptyState
          icon={Users}
          title="No followers yet"
          message="Share books and stay active to attract followers."
        />
      )}
    </div>
  );
}

export default function FollowingPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Social</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Connections
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            People you follow and people who follow you
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <HeaderActionLink href="/search">
            <Search className="h-3.5 w-3.5" />
            Find readers
          </HeaderActionLink>
          <HeaderActionLink href="/activity">
            <Users className="h-3.5 w-3.5" />
            Activity feed
          </HeaderActionLink>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <FollowingContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see your connections." />
      </Unauthenticated>
    </main>
  );
}
