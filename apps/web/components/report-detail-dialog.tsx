"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { type Condition, type ReportType, CONDITION_LABELS, REPORT_TYPE_LABELS } from "@/convex/lib/validators";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileWarning,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

export const CONDITION_BADGE_VARIANT: Record<Condition, "default" | "secondary" | "destructive"> = {
  like_new: "default",
  good: "secondary",
  fair: "secondary",
  worn: "destructive",
};

export function ReportDetailDialog({
  report,
  onClose,
  getReporterName,
}: {
  report: Doc<"conditionReports"> | null;
  onClose: () => void;
  getReporterName: (report: Doc<"conditionReports">) => string;
}) {
  return (
    <Dialog
      open={report !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5" />
            {report ? REPORT_TYPE_LABELS[report.type as ReportType] : ""}
          </DialogTitle>
        </DialogHeader>

        {report && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Copy ID</span>
                <p className="font-mono text-xs">
                  {report.copyId}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Reported By</span>
                <p className="font-medium">
                  {getReporterName(report)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Date</span>
                <p className="font-medium">
                  {new Date(report.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="text-sm">
              <span className="text-muted-foreground">Description</span>
              <p>{report.description}</p>
            </div>

            {/* Condition comparison */}
            <div>
              <p className="mb-2 text-sm font-medium">Condition Change</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Before</p>
                  <Badge
                    variant={CONDITION_BADGE_VARIANT[
                      report.previousCondition as Condition
                    ]}
                    className="mt-1"
                  >
                    {CONDITION_LABELS[report.previousCondition as Condition]}
                  </Badge>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">After</p>
                  <Badge
                    variant={CONDITION_BADGE_VARIANT[
                      report.newCondition as Condition
                    ]}
                    className="mt-1"
                  >
                    {CONDITION_LABELS[report.newCondition as Condition]}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Photos */}
            {report.photos.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="mb-2 text-sm font-medium">Photos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {report.photos.map((photo, i) => (
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
                  onClick={onClose}
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
  );
}
