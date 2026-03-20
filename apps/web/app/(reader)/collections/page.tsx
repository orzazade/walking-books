"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { HeaderActionLink } from "@/components/header-action-link";
import {
  Library,
  Plus,
  Trash2,
  Globe,
  Lock,
  BookOpen,
  ChevronRight,
  Users,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState } from "@/components/empty-state";

function CreateCollectionForm({ onCreated }: { onCreated: () => void }) {
  const create = useMutation(api.collections.create);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await create({
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
      });
      setName("");
      setDescription("");
      setIsPublic(false);
      onCreated();
      toast.success("Collection created");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create collection"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Collection name"
        maxLength={100}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        maxLength={500}
        rows={2}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsPublic((v) => !v)}
          className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          {isPublic ? (
            <>
              <Globe className="h-3.5 w-3.5" />
              Public — anyone can view
            </>
          ) : (
            <>
              <Lock className="h-3.5 w-3.5" />
              Private — only you
            </>
          )}
        </button>
        <Button
          type="submit"
          disabled={!name.trim() || saving}
          className="rounded-lg"
          size="sm"
        >
          {saving ? "Creating..." : "Create"}
        </Button>
      </div>
    </form>
  );
}

function CollectionCard({
  collection,
}: {
  collection: {
    _id: Id<"collections">;
    name: string;
    description?: string;
    isPublic: boolean;
    bookCount: number;
    createdAt: number;
  };
}) {
  const remove = useMutation(api.collections.remove);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await remove({ collectionId: collection._id });
      toast.success("Collection deleted");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete collection"));
      setDeleting(false);
    }
  }

  return (
    <div className="group rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/collections/${collection._id}`}
          className="min-w-0 flex-1"
        >
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[0.9375rem] font-medium">
              {collection.name}
            </h3>
            {collection.isPublic ? (
              <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
          </div>
          {collection.description && (
            <p className="mt-0.5 line-clamp-1 text-[0.8125rem] text-muted-foreground">
              {collection.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
            <BookOpen className="h-3 w-3" />
            {collection.bookCount} {collection.bookCount === 1 ? "book" : "books"}
            <ChevronRight className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete collection"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function FollowedCollections() {
  const collections = useQuery(api.collections.followedCollections);

  if (collections === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/40 bg-card/60 p-4"
          >
            <div className="animate-shimmer h-4 w-40 rounded-md bg-muted" />
            <div className="animate-shimmer mt-2 h-3 w-24 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="No followed collections"
        message="Follow public collections from the community to keep track of curated reading lists."
      />
    );
  }

  return (
    <div className="space-y-2">
      {collections.map((collection) => (
        <Link
          key={collection._id}
          href={`/collections/${collection._id}`}
          className="group block rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
        >
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[0.9375rem] font-medium">
              {collection.name}
            </h3>
            <Heart className="h-3 w-3 shrink-0 fill-current text-primary" />
          </div>
          {collection.description && (
            <p className="mt-0.5 line-clamp-1 text-[0.8125rem] text-muted-foreground">
              {collection.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[0.75rem] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3" />
              {collection.bookCount} {collection.bookCount === 1 ? "book" : "books"}
            </span>
            <span>by {collection.ownerName}</span>
            <ChevronRight className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function CommunityCollections() {
  const collections = useQuery(api.collections.publicCollections);

  if (collections === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/40 bg-card/60 p-4"
          >
            <div className="animate-shimmer h-4 w-40 rounded-md bg-muted" />
            <div className="animate-shimmer mt-2 h-3 w-24 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No community collections yet"
        message="Be the first to create a public collection for others to discover."
      />
    );
  }

  return (
    <div className="space-y-2">
      {collections.map((collection) => (
        <Link
          key={collection._id}
          href={`/collections/${collection._id}`}
          className="group block rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
        >
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[0.9375rem] font-medium">
              {collection.name}
            </h3>
            <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
          </div>
          {collection.description && (
            <p className="mt-0.5 line-clamp-1 text-[0.8125rem] text-muted-foreground">
              {collection.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[0.75rem] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3" />
              {collection.bookCount} {collection.bookCount === 1 ? "book" : "books"}
            </span>
            {collection.followerCount > 0 && (
              <span className="flex items-center gap-1.5">
                <Heart className="h-3 w-3" />
                {collection.followerCount}
              </span>
            )}
            <span>by {collection.ownerName}</span>
            <ChevronRight className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function CollectionsContent() {
  const { isAuthenticated } = useConvexAuth();
  const collections = useQuery(
    api.collections.myCollections,
    isAuthenticated ? undefined : "skip",
  );
  const [showCreate, setShowCreate] = useState(false);

  // Loading
  if (collections === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/40 bg-card/60 p-4"
          >
            <div className="animate-shimmer h-4 w-40 rounded-md bg-muted" />
            <div className="animate-shimmer mt-2 h-3 w-24 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create toggle / form */}
      {showCreate ? (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
          <h3 className="mb-3 text-[0.875rem] font-medium">
            New Collection
          </h3>
          <CreateCollectionForm onCreated={() => setShowCreate(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-card/30 px-4 py-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Create a collection
        </button>
      )}

      {/* Empty state */}
      {collections.length === 0 && !showCreate && (
        <EmptyState
          icon={Library}
          title="No collections yet"
          message="Organize your favorite books into collections to share or keep track of reading themes."
        />
      )}

      {/* Collection list */}
      {collections.length > 0 && (
        <div className="space-y-2">
          {collections.map((collection) => (
            <CollectionCard
              key={collection._id}
              collection={collection}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CollectionsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Library</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Collections
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Organize books into themed collections — reading lists, favorites,
            or recommendations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <HeaderActionLink href="/browse">
            <BookOpen className="h-3.5 w-3.5" />
            Browse books
          </HeaderActionLink>
        </div>
      </div>

      {/* My Collections (auth-gated) */}
      <Authenticated>
        <CollectionsContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to create and manage your book collections." />
      </Unauthenticated>

      {/* Followed Collections (auth-gated) */}
      <Authenticated>
        <div className="mt-10">
          <h2 className="mb-4 font-serif text-[1.25rem] font-semibold tracking-[-0.01em]">
            Following
          </h2>
          <p className="mb-5 text-[0.8125rem] text-muted-foreground">
            Collections you follow — stay updated on curated reading lists
          </p>
          <FollowedCollections />
        </div>
      </Authenticated>

      {/* Community Collections (public) */}
      <div className="mt-10">
        <h2 className="mb-4 font-serif text-[1.25rem] font-semibold tracking-[-0.01em]">
          Community Collections
        </h2>
        <p className="mb-5 text-[0.8125rem] text-muted-foreground">
          Public reading lists curated by the community
        </p>
        <CommunityCollections />
      </div>
    </main>
  );
}
