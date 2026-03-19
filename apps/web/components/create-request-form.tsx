"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { X } from "lucide-react";

export function CreateRequestForm({ onClose }: { onClose: () => void }) {
  const create = useMutation(api.bookRequests.create);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await create({
        title: title.trim(),
        author: author.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success("Request posted!");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold">Request a Book</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-[0.8125rem] font-medium">
            Book title <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dune"
            maxLength={300}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.8125rem] font-medium">
            Author <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="e.g. Frank Herbert"
            maxLength={200}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.8125rem] font-medium">
            Note <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Any edition preference, why you want it, etc."
            maxLength={500}
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-lg text-[0.8125rem]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || !title.trim()}
            className="rounded-lg text-[0.8125rem]"
          >
            {submitting ? "Posting..." : "Post Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
