"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CopyJourney } from "@/components/copy-journey";

export default function CopyDetailPage() {
  const params = useParams();
  const copyId = params.id as Id<"copies">;

  const copy = useQuery(api.copies.byId, { copyId });
  const journey = useQuery(api.copies.journey, { copyId });
  const book = useQuery(
    api.books.byId,
    copy?.bookId ? { bookId: copy.bookId } : "skip",
  );

  if (copy === undefined) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (copy === null) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-muted-foreground">Copy not found.</p>
      </main>
    );
  }

  const statusColor: Record<string, string> = {
    available: "bg-emerald-100 text-emerald-700",
    reserved: "bg-amber-100 text-amber-700",
    checked_out: "bg-blue-100 text-blue-700",
    recalled: "bg-orange-100 text-orange-700",
    lost: "bg-red-100 text-red-700",
    damaged: "bg-red-100 text-red-700",
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-4">
        {book && (
          <div>
            <Link
              href={`/book/${copy.bookId}`}
              className="text-primary hover:underline"
            >
              {book.title}
            </Link>
            <p className="text-sm text-muted-foreground">by {book.author}</p>
          </div>
        )}

        <h1 className="text-2xl font-bold">Copy Details</h1>

        <div className="flex flex-wrap gap-2">
          <Badge className={statusColor[copy.status] ?? ""}>
            {copy.status.replace("_", " ")}
          </Badge>
          <Badge variant="outline">
            {copy.condition.replace("_", " ")}
          </Badge>
          <Badge variant="secondary">{copy.ownershipType}</Badge>
        </div>
      </div>

      <Separator className="my-8" />

      <section>
        <h2 className="mb-4 text-xl font-semibold">Journey Timeline</h2>
        {journey === undefined ? (
          <p className="text-muted-foreground">Loading journey...</p>
        ) : (
          <CopyJourney entries={journey} />
        )}
      </section>
    </main>
  );
}
