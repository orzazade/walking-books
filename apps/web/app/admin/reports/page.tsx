"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Doc } from "@/convex/_generated/dataModel";
import { type Condition, type ReportType, CONDITION_LABELS, REPORT_TYPE_LABELS } from "@/convex/lib/validators";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReportDetailDialog } from "@/components/report-detail-dialog";
import {
  FileWarning,
  Camera,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

const CONDITION_BADGE_VARIANT: Record<Condition, "default" | "secondary" | "destructive"> = {
  like_new: "default",
  good: "secondary",
  fair: "secondary",
  worn: "destructive",
};

export default function AdminReportsPage() {
  const allReports = useQuery(api.conditionReports.listAll);
  const allUsers = useQuery(api.users.listAll);
  const [selectedReport, setSelectedReport] = useState<Doc<"conditionReports"> | null>(null);
  const [filter, setFilter] = useState<"all" | "damage_report">("damage_report");

  if (allReports === undefined || allUsers === undefined) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const sorted = [...allReports].sort((a, b) => b.createdAt - a.createdAt);
  const filtered = filter === "all" ? sorted : sorted.filter((r) => r.type === "damage_report");

  function getReporterName(report: Doc<"conditionReports">) {
    if (report.reportedByUserId) {
      const user = allUsers?.find((u) => u._id === report.reportedByUserId);
      return user?.name ?? "Unknown user";
    }
    return "Partner staff";
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
                    <Badge
                      variant={
                        report.type === "damage_report"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {REPORT_TYPE_LABELS[report.type as ReportType]}
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
                      variant={CONDITION_BADGE_VARIANT[report.previousCondition as Condition]}
                      className="text-xs"
                    >
                      {CONDITION_LABELS[report.previousCondition as Condition]}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge
                      variant={CONDITION_BADGE_VARIANT[report.newCondition as Condition]}
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
                    {formatDate(report.createdAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReportDetailDialog
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        getReporterName={getReporterName}
      />
    </>
  );
}
