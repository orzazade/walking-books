"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Eye,
  Plus,
  Loader2,
  Camera,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  pickup_check: "Pickup Check",
  return_check: "Return Check",
  damage_report: "Damage Report",
};

const TYPE_COLORS: Record<string, string> = {
  pickup_check: "bg-blue-100 text-blue-700",
  return_check: "bg-green-100 text-green-700",
  damage_report: "bg-red-100 text-red-700",
};

const TYPE_FILTERS = [
  { value: "all", label: "All Reports" },
  { value: "pickup_check", label: "Pickup Checks" },
  { value: "return_check", label: "Return Checks" },
  { value: "damage_report", label: "Damage Reports" },
] as const;

export default function PartnerReportsPage() {
  const location = useQuery(api.partnerLocations.myLocation);
  const reports = useQuery(
    api.conditionReports.byLocation,
    location ? { locationId: location._id } : "skip",
  );
  const allCopies = useQuery(
    api.copies.allAtLocation,
    location ? { locationId: location._id } : "skip",
  );

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [newReportOpen, setNewReportOpen] = useState(false);

  if (location === undefined || reports === undefined) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (location === null) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No partner location found for your account.
        </CardContent>
      </Card>
    );
  }

  const filteredReports =
    typeFilter === "all"
      ? reports
      : reports.filter((r) => r.type === typeFilter);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Condition Reports</h1>
          <p className="mt-1 text-muted-foreground">
            {reports.length} reports for {location.name}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setNewReportOpen(true)}>
          <Plus className="h-4 w-4" /> New Report
        </Button>
        <Dialog open={newReportOpen} onOpenChange={setNewReportOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Damage Report</DialogTitle>
            </DialogHeader>
            <NewReportForm
              copies={allCopies ?? []}
              onSuccess={() => setNewReportOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Type filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? reports.length
              : reports.filter((r: any) => r.type === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                typeFilter === f.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted text-muted-foreground hover:border-muted-foreground/50"
              }`}
            >
              {f.label}
              <span className="ml-1 text-xs">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Reports list */}
      {filteredReports.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No condition reports found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report: any) => (
            <Card key={report._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[report.type] || ""}`}
                      >
                        {TYPE_LABELS[report.type] || report.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Copy #{report.copyId.slice(-6)}
                      </span>
                    </div>
                    <p className="text-sm">{report.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {report.previousCondition.replace("_", " ")} &rarr;{" "}
                        {report.newCondition.replace("_", " ")}
                      </span>
                      <span>
                        {new Date(report.createdAt).toLocaleDateString()}{" "}
                        {new Date(report.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.photos.length > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Camera className="h-3 w-3" />
                        {report.photos.length}
                      </Badge>
                    )}
                    {report.type === "damage_report" && (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>

                {/* Photo thumbnails */}
                {report.photos.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {report.photos.map((photo: string, i: number) => (
                      <img
                        key={i}
                        src={photo}
                        alt={`Report photo ${i + 1}`}
                        className="h-16 w-16 rounded-md border object-cover"
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function NewReportForm({
  copies,
  onSuccess,
}: {
  copies: Array<{
    _id: Id<"copies">;
    condition: string;
    status: string;
  }>;
  onSuccess: () => void;
}) {
  const createReport = useMutation(api.conditionReports.create);
  const [copyId, setCopyId] = useState("");
  const [description, setDescription] = useState("");
  const [newCondition, setNewCondition] = useState<string>("fair");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCopy = copies.find((c) => c._id === copyId);
  const CONDITIONS = ["like_new", "good", "fair", "worn"] as const;

  async function handleSubmit() {
    if (!copyId || !description.trim()) {
      setError("Please select a copy and provide a description.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createReport({
        copyId: copyId as Id<"copies">,
        type: "damage_report",
        photos: [],
        description: description.trim(),
        previousCondition: selectedCopy?.condition || "unknown",
        newCondition,
      });
      onSuccess();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create report",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Copy</label>
        <select
          value={copyId}
          onChange={(e) => setCopyId(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a copy...</option>
          {copies.map((c) => (
            <option key={c._id} value={c._id}>
              #{c._id.slice(-6)} - {c.condition.replace("_", " ")} ({c.status})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium">New Condition</label>
        <div className="mt-1 flex gap-2">
          {CONDITIONS.map((cond) => (
            <button
              key={cond}
              onClick={() => setNewCondition(cond)}
              className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
                newCondition === cond
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted text-muted-foreground hover:border-muted-foreground/50"
              }`}
            >
              {cond.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the damage or issue..."
          className="mt-1"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        className="w-full gap-2"
        disabled={loading || !copyId || !description.trim()}
        onClick={handleSubmit}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        Submit Damage Report
      </Button>
    </div>
  );
}
