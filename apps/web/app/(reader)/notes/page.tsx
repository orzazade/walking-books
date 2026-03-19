"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { getErrorMessage, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { StickyNote, Trash2, Pencil, BookOpen } from "lucide-react";

function NotesContent() {
  const notes = useQuery(api.bookNotes.myNotes);
  const save = useMutation(api.bookNotes.save);
  const remove = useMutation(api.bookNotes.remove);
  const [editingId, setEditingId] = useState<Id<"bookNotes"> | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingBookId, setDeletingBookId] = useState<Id<"books"> | null>(null);

  async function handleSave(bookId: Id<"books">) {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      await save({ bookId, content: editContent });
      toast.success("Note saved");
      setEditingId(null);
      setEditContent("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save note"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bookId: Id<"books">) {
    setDeletingBookId(bookId);
    try {
      await remove({ bookId });
      toast.success("Note deleted");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete note"));
    } finally {
      setDeletingBookId(null);
    }
  }

  if (notes === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-card/60 p-4">
            <div className="space-y-2">
              <div className="animate-shimmer h-5 w-40 rounded-md bg-muted" />
              <div className="animate-shimmer h-4 w-full rounded-md bg-muted" />
              <div className="animate-shimmer h-4 w-3/4 rounded-md bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <StickyNote className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-lg font-semibold">No notes yet</h2>
        <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
          Add personal notes on any book page to remember your thoughts.
        </p>
        <Link
          href="/browse"
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground"
        >
          Browse books
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <div
          key={note._id}
          className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card/80"
        >
          {/* Book info */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/book/${note.bookId}`}
                className="flex items-center gap-1.5 hover:underline"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium text-[0.875rem]">
                  {note.bookTitle}
                </span>
              </Link>
              <p className="mt-0.5 pl-5 text-[0.75rem] text-muted-foreground">
                by {note.bookAuthor}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => {
                  setEditingId(note._id);
                  setEditContent(note.content);
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(note.bookId)}
                disabled={deletingBookId === note.bookId}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Note content */}
          {editingId === note._id ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={10000}
                rows={4}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex items-center justify-between">
                <span className="text-[0.75rem] text-muted-foreground">
                  {editContent.length}/10000
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingId(null); setEditContent(""); }}
                    className="rounded-lg text-[0.75rem]"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSave(note.bookId)}
                    disabled={saving || !editContent.trim()}
                    className="rounded-lg text-[0.75rem]"
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-[0.8125rem] text-muted-foreground">
              {note.content}
            </p>
          )}

          {/* Timestamp */}
          <p className="mt-2 text-[0.6875rem] text-muted-foreground/60">
            Updated {timeAgo(note.updatedAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function NotesPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="section-kicker mb-3">Personal</div>
        <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
          My Notes
        </h1>
        <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
          Your personal notes and thoughts on books you&apos;ve read
        </p>
      </div>

      {/* Content */}
      <Authenticated>
        <NotesContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to view your book notes." />
      </Unauthenticated>
    </main>
  );
}
