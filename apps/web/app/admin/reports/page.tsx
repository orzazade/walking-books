"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Doc } from "@/convex/_generated/dataModel";
import { type Condition, CONDITION_LABELS } from "@/convex/lib/validators";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileWarning,
  Camera,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

export default function AdminReportsPage() {
  const allReports = useQuery(api.conditionReports.listAll);
  const allUsers = useQuery(api.users.listAll);
  const [selectedReport, setSelectedReport] = useState<Doc<"conditionReports"> | null>(null);
  const [filter, setFilter] = useState<"all" | "damage_report">("damage_report");

  if (allReports === undefined || allUsers === undefined) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const filtered =
    filter === "all"
      ? [...allReports].sort((a, b) => b.createdAt - a.createdAt)
      : [...allReports]
          .filter((r) => r.type === "damage_report")
          .sort((a, b) => b.createdAt - a.createdAt);

  function getReporterName(report: Doc<"conditionReports">) {
    if (report.reportedByUserId) {
      const user = allUsers?.find((u) => u._id === report.reportedByUserId);
      return user?.name ?? "Unknown user";
    }
    return "Partner staff";
  }

  function conditionBadgeColor(condition: Condition) {
    switch (condition) {
      case "like_new":
        return "default" as const;
      case "good":
      case "fair":
        return "secondary" as const;
      case "worn":
        return "destructive" as const;
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Condition Reports</h1>
        <p className="mt-1 text-muted-foreground">
          {allReports.filter((r) => r.type === "damage_report").length} damage
          reports total
        </p>
      </div>

      {/* Filter toggle */}
      <div className="mb-4 flex gap-2">
        <Button
          variant={filter === "damage_report" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("damage_report")}
          className="gap-1"
        >
          <AlertTriangle className="h-3 w-3" /> Damage Reports
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          className="gap-1"
        >
          <FileWarning className="h-3 w-3" /> All Reports
        </Button>
      </div>

      {/* Reports list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
            No reports to review.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Card
              key={report._id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelectedReport(report)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {report.type === "damage_report" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Camera className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium capitalize">
                      {report.type.replace(/_/g, " ")}
                    </span>
                    <Badge
                      variant={
                        report.type === "damage_report"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {report.type === "damage_report"
                        ? "Damage"
                        : report.type === "pickup_check"
                          ? "Pickup"
                          : "Return"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {report.description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    By: {getReporterName(report)} | Copy #
                    {report.copyId.slice(-6)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Condition change */}
                  <div className="flex items-center gap-1 text-xs">
                    <Badge
                      variant={conditionBadgeColor(report.previousCondition)}
                      className="text-xs"
                    >
                      {CONDITION_LABELS[report.previousCondition as Condition]}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge
                      variant={conditionBadgeColor(report.newCondition)}
                      className="text-xs"
                    >
                      {CONDITION_LABELS[report.newCondition as Condition]}
                    </Badge>
                  </div>

                  {report.photos.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Camera className="mr-1 h-3 w-3" />
                      {report.photos.length}
                    </Badge>
                  )}

                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Report detail modal */}
      <Dialog
        open={selectedReport !== null}
        onOpenChange={(open) => !open && setSelectedReport(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5" />
              {selectedReport?.type.replace(/_/g, " ")}
            </DialogTitle>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Copy ID</span>
                  <p className="font-mono text-xs">
                    {selectedReport.copyId}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Reported By</span>
                  <p className="font-medium">
                    {getReporterName(selectedReport)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <p className="font-medium">
                    {new Date(selectedReport.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p>
                    <Badge
                      variant={
                        selectedReport.type === "damage_report"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {selectedReport.type.replace(/_/g, " ")}
                    </Badge>
                  </p>
                </div>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Description</span>
                <p>{selectedReport.description}</p>
              </div>

              {/* Condition comparison */}
              <div>
                <p className="mb-2 text-sm font-medium">Condition Change</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-md border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Before</p>
                    <Badge
                      variant={conditionBadgeColor(
                        selectedReport.previousCondition,
                      )}
                      className="mt-1"
                    >
                      {CONDITION_LABELS[selectedReport.previousCondition as Condition]}
                    </Badge>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 rounded-md border p-3 text-center">
                    <p className="text-xs text-muted-foreground">After</p>
                    <Badge
                      variant={conditionBadgeColor(
                        selectedReport.newCondition,
                      )}
                      className="mt-1"
                    >
                      {CONDITION_LABELS[selectedReport.newCondition as Condition]}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Photos side by side */}
              {selectedReport.photos.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-sm font-medium">Photos</p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedReport.photos.map((photo, i) => (
                        <img
                          key={i}
                          src={photo}
                          alt={`Report photo ${i + 1}`}
                          className="h-40 w-full rounded-md object-cover"
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Actions */}
              <div>
                <p className="mb-2 text-sm font-medium">Actions</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedReport(null)}
                    className="gap-1"
                  >
                    <CheckCircle className="h-3 w-3" /> Dismiss Report
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
