"use client";

import { type Doc } from "@/convex/_generated/dataModel";
import {
  type Condition,
  type ReportType,
  CONDITION_LABELS,
  REPORT_TYPE_LABELS,
} from "@/convex/lib/validators";
import { CONDITION_BADGE_VARIANT } from "@/components/report-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ArrowRight, ClipboardCheck, RotateCcw, AlertTriangle } from "lucide-react";

const REPORT_TYPE_ICON: Record<ReportType, typeof ClipboardCheck> = {
  pickup_check: ClipboardCheck,
  return_check: RotateCcw,
  damage_report: AlertTriangle,
};

const REPORT_TYPE_COLOR: Record<ReportType, string> = {
  pickup_check: "border-blue-400 bg-blue-50 dark:bg-blue-950",
  return_check: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950",
  damage_report: "border-red-400 bg-red-50 dark:bg-red-950",
};

interface ConditionTimelineProps {
  reports: Doc<"conditionReports">[];
}

export function ConditionTimeline({ reports }: ConditionTimelineProps) {
  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No condition reports yet.
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

      {reports.map((report) => {
        const Icon = REPORT_TYPE_ICON[report.type as ReportType];
        const conditionChanged =
          report.previousCondition !== report.newCondition;

        return (
          <div key={report._id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Dot */}
            <div className="relative z-10 mt-1.5 h-6 w-6 shrink-0 rounded-full border-2 border-primary bg-background flex items-center justify-center">
              <Icon className="h-3 w-3 text-primary" />
            </div>

            <div className="flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">
                  {REPORT_TYPE_LABELS[report.type as ReportType]}
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatDate(report.createdAt)}
                </span>
              </div>

              {/* Condition change */}
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    CONDITION_BADGE_VARIANT[
                      report.previousCondition as Condition
                    ]
                  }
                  className="text-xs"
                >
                  {CONDITION_LABELS[report.previousCondition as Condition]}
                </Badge>
                {conditionChanged && (
                  <>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge
                      variant={
                        CONDITION_BADGE_VARIANT[
                          report.newCondition as Condition
                        ]
                      }
                      className="text-xs"
                    >
                      {CONDITION_LABELS[report.newCondition as Condition]}
                    </Badge>
                  </>
                )}
              </div>

              {/* Description */}
              {report.description && (
                <p className="text-xs text-muted-foreground">
                  {report.description}
                </p>
              )}

              {/* Photos */}
              {report.photos.length > 0 && (
                <div className="flex gap-1.5 pt-1">
                  {report.photos.slice(0, 4).map((photo, i) => (
                    <img
                      key={i}
                      src={photo}
                      alt={`Condition photo ${i + 1}`}
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  ))}
                  {report.photos.length > 4 && (
                    <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                      +{report.photos.length - 4}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
