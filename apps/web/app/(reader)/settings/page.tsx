"use client";

import { useQuery, useMutation, useConvexAuth, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Bell, BellOff } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

const NOTIFICATION_TYPES = [
  { key: "reservation_confirmed", label: "Reservation Confirmed", description: "When someone reserves your book" },
  { key: "reservation_expired", label: "Reservation Expired", description: "When a reservation expires" },
  { key: "book_picked_up", label: "Book Picked Up", description: "When your shared book is picked up" },
  { key: "book_returned", label: "Book Returned", description: "When a book is returned" },
  { key: "book_recalled", label: "Book Recalled", description: "When your borrowed book is recalled" },
  { key: "waitlist_notified", label: "Waitlist Update", description: "When you reach the front of a waitlist" },
  { key: "waitlist_available", label: "Waitlist Available", description: "When a waitlisted book becomes available" },
  { key: "wishlist_available", label: "Wishlist Available", description: "When a wishlisted book becomes available" },
  { key: "reputation_milestone", label: "Reputation Milestone", description: "When you reach a reputation milestone" },
  { key: "achievement_unlocked", label: "Achievement Unlocked", description: "When you earn an achievement" },
  { key: "book_request_fulfilled", label: "Book Request Fulfilled", description: "When someone fulfills your book request" },
] as const;

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
  const notifPrefs = useQuery(api.notificationPreferences.get, isAuthenticated ? {} : "skip");
  const updateNotifPrefs = useMutation(api.notificationPreferences.update);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>({});
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [notifsSaved, setNotifsSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setBio(user.bio ?? "");
      setAvatarUrl(user.avatarUrl ?? "");
      setSelectedGenres(user.favoriteGenres ?? []);
    }
  }, [user]);

  useEffect(() => {
    if (notifPrefs) {
      setNotifSettings({ ...notifPrefs });
    }
  }, [notifPrefs]);

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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save settings"));
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

      {/* Save Profile */}
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

      {/* Notification Preferences */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-serif text-[1.0625rem] font-semibold">
            Notification Preferences
          </h2>
        </div>
        <p className="mb-4 text-[0.8125rem] text-muted-foreground">
          Choose which notifications you receive. Disabled notifications won&apos;t appear in your inbox.
        </p>
        <div className="space-y-1">
          {NOTIFICATION_TYPES.map(({ key, label, description }) => {
            const enabled = notifSettings[key] ?? true;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setNotifSettings((prev) => ({ ...prev, [key]: !enabled }))
                }
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                {enabled ? (
                  <Bell className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <BellOff className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className={`text-[0.8125rem] font-medium ${enabled ? "text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </div>
                  <div className="text-[0.75rem] text-muted-foreground">
                    {description}
                  </div>
                </div>
                <div
                  className={`h-5 w-9 shrink-0 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`}
                  />
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={async () => {
              setSavingNotifs(true);
              setNotifsSaved(false);
              try {
                await updateNotifPrefs({
                  reservation_confirmed: notifSettings.reservation_confirmed ?? true,
                  reservation_expired: notifSettings.reservation_expired ?? true,
                  book_picked_up: notifSettings.book_picked_up ?? true,
                  book_returned: notifSettings.book_returned ?? true,
                  book_recalled: notifSettings.book_recalled ?? true,
                  waitlist_notified: notifSettings.waitlist_notified ?? true,
                  waitlist_available: notifSettings.waitlist_available ?? true,
                  wishlist_available: notifSettings.wishlist_available ?? true,
                  reputation_milestone: notifSettings.reputation_milestone ?? true,
                  achievement_unlocked: notifSettings.achievement_unlocked ?? true,
                  book_request_fulfilled: notifSettings.book_request_fulfilled ?? true,
                });
                setNotifsSaved(true);
                setTimeout(() => setNotifsSaved(false), 3000);
              } catch (err: unknown) {
                toast.error(getErrorMessage(err, "Failed to save notification preferences"));
              } finally {
                setSavingNotifs(false);
              }
            }}
            disabled={savingNotifs}
            variant="outline"
            className="gap-1.5 rounded-lg text-[0.8125rem]"
          >
            {savingNotifs ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> Save Preferences
              </>
            )}
          </Button>
          {notifsSaved && (
            <span className="text-[0.8125rem] text-primary">
              Preferences saved!
            </span>
          )}
        </div>
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
