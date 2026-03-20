"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { PenLine, Trash2, X, Check } from "lucide-react";

export function BookNoteSection({ bookId }: { bookId: Id<"books"> }) {
  const note = useQuery(api.bookNotes.myNote, { bookId });
  const saveNote = useMutation(api.bookNotes.save);
  const removeNote = useMutation(api.bookNotes.remove);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (note === undefined) return null;

  const startEditing = () => {
    setDraft(note?.content ?? "");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft("");
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await saveNote({ bookId, content: trimmed });
      toast.success(note ? "Note updated" : "Note saved");
      setEditing(false);
      setDraft("");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save note"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await removeNote({ bookId });
      toast.success("Note deleted");
      setEditing(false);
      setDraft("");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete note"));
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="mb-2 text-[0.8125rem] font-medium">
          <PenLine className="mr-1.5 inline-block h-3.5 w-3.5 text-primary" />
          {note ? "Edit your note" : "Add a personal note"}
        </p>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Jot down your thoughts about this book..."
          className="min-h-[80px] resize-y rounded-lg border-border/60 bg-background text-sm"
          maxLength={10000}
          autoFocus
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[0.6875rem] text-muted-foreground">
            {draft.trim().length.toLocaleString()} / 10,000
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-lg text-[0.75rem]"
              onClick={cancelEditing}
              disabled={saving}
            >
              <X className="mr-1 h-3 w-3" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 rounded-lg text-[0.75rem]"
              onClick={handleSave}
              disabled={saving || !draft.trim()}
            >
              <Check className="mr-1 h-3 w-3" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (note) {
    return (
      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-[0.6875rem] font-medium uppercase tracking-wider text-primary/70">
              Your Note
            </p>
            <p className="whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-foreground/80">
              {note.content}
            </p>
            <p className="mt-2 text-[0.6875rem] text-muted-foreground">
              {new Date(note.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-lg p-0"
              onClick={startEditing}
              title="Edit note"
            >
              <PenLine className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-lg p-0 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete note"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-lg text-[0.75rem]"
        onClick={startEditing}
      >
        <PenLine className="mr-1.5 h-3.5 w-3.5" />
        Add a Note
      </Button>
    </div>
  );
}
