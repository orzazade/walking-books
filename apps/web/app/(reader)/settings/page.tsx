"use client";

import { useQuery, useMutation, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const GENRE_OPTIONS = [
  "Fiction",
  "Non-Fiction",
  "Science Fiction",
  "Fantasy",
  "Mystery",
  "Romance",
  "Thriller",
  "Biography",
  "History",
  "Science",
  "Self-Help",
  "Poetry",
  "Philosophy",
  "Children",
  "Young Adult",
  "Classics",
  "Horror",
  "Art",
  "Travel",
  "Cooking",
];

function SettingsContent() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser, isAuthenticated ? {} : "skip");
  const updateUser = useMutation(api.users.update);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setBio(user.bio ?? "");
      setAvatarUrl(user.avatarUrl ?? "");
      setSelectedGenres(user.favoriteGenres ?? []);
    }
  }, [user]);

  if (user === undefined) {
    return (
      <div className="space-y-6">
        <div className="animate-shimmer h-48 rounded-2xl bg-muted" />
        <div className="animate-shimmer h-32 rounded-2xl bg-muted" />
      </div>
    );
  }

  if (user === null) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        User not found.
      </p>
    );
  }

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : [...prev, genre],
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateUser({
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        favoriteGenres: selectedGenres,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <h2 className="mb-4 font-serif text-[1.0625rem] font-semibold">
          Profile Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[0.8125rem] font-medium">
              Display Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg text-[0.875rem]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[0.8125rem] font-medium">
              Bio
            </label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell other readers about yourself..."
              className="rounded-lg text-[0.875rem]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[0.8125rem] font-medium">
              Avatar URL
            </label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-lg text-[0.875rem]"
            />
          </div>
        </div>
      </div>

      {/* Favorite Genres */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <h2 className="mb-4 font-serif text-[1.0625rem] font-semibold">
          Favorite Genres
        </h2>
        <div className="flex flex-wrap gap-2">
          {GENRE_OPTIONS.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => toggleGenre(genre)}
              className={`rounded-lg border px-3 py-1.5 text-[0.8125rem] font-medium transition-all duration-200 ${
                selectedGenres.includes(genre)
                  ? "border-primary bg-primary/8 text-primary shadow-sm shadow-primary/10"
                  : "border-border/50 bg-card/60 text-foreground hover:border-border hover:bg-card"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5 rounded-lg text-[0.8125rem]"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" /> Save Changes
            </>
          )}
        </Button>
        {saved && (
          <span className="text-[0.8125rem] text-primary">
            Changes saved!
          </span>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-8">
        <div className="section-kicker mb-3">Account</div>
        <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
          Settings
        </h1>
        <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
          Manage your profile and preferences
        </p>
      </div>

      <Authenticated>
        <SettingsContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to access settings." />
      </Unauthenticated>
    </main>
  );
}
