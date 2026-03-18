interface JourneyEntry {
  pickupLocationId: string;
  dropoffLocationId?: string;
  pickedUpAt: number;
  returnedAt?: number;
  conditionAtPickup: string;
  conditionAtReturn?: string;
  readerNote?: string;
}

interface CopyJourneyProps {
  entries: JourneyEntry[];
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CopyJourney({ entries }: CopyJourneyProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No journey entries yet.</p>;
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

      {entries.map((entry, i) => (
        <div key={i} className="relative flex gap-4 pb-6 last:pb-0">
          {/* Dot */}
          <div className="relative z-10 mt-1.5 h-6 w-6 shrink-0 rounded-full border-2 border-primary bg-background flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-primary" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">
              Picked up {formatDate(entry.pickedUpAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              Condition: {entry.conditionAtPickup.replace("_", " ")}
            </p>
            {entry.returnedAt && (
              <p className="text-xs text-muted-foreground">
                Returned {formatDate(entry.returnedAt)}
                {entry.conditionAtReturn &&
                  ` — ${entry.conditionAtReturn.replace("_", " ")}`}
              </p>
            )}
            {entry.readerNote && (
              <p className="mt-1 rounded-md bg-muted p-2 text-xs italic">
                &ldquo;{entry.readerNote}&rdquo;
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
