"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { QrScanner } from "@/components/qr-scanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ScanLine,
  CheckCircle,
  Package,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  BookOpen,
} from "lucide-react";

type CopyId = Id<"copies">;

export default function PartnerScanPage() {
  const [scannedCopyId, setScannedCopyId] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const location = useQuery(api.partnerLocations.myLocation);

  function handleScan(copyId: string) {
    setScannedCopyId(copyId);
    setActionResult(null);
  }

  function handleReset() {
    setScannedCopyId(null);
    setActionResult(null);
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Scan QR Code</h1>
        <p className="mt-1 text-muted-foreground">
          Scan a book&apos;s QR code to process handoffs, check-ins, or new
          arrivals
        </p>
      </div>

      {actionResult && (
        <Card className={`mb-6 ${actionResult.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <CardContent className="flex items-center gap-3 p-4">
            {actionResult.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
            <p className={`text-sm font-medium ${actionResult.type === "success" ? "text-green-700" : "text-red-700"}`}>
              {actionResult.message}
            </p>
          </CardContent>
        </Card>
      )}

      {!scannedCopyId ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5" /> Scan or Enter Copy ID
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QrScanner onScan={handleScan} />
          </CardContent>
        </Card>
      ) : location ? (
        <ScannedCopyActions
          copyId={scannedCopyId as CopyId}
          locationId={location._id}
          onReset={handleReset}
          onResult={setActionResult}
        />
      ) : (
        <p className="text-muted-foreground">Loading location...</p>
      )}
    </>
  );
}

function ScannedCopyActions({
  copyId,
  locationId,
  onReset,
  onResult,
}: {
  copyId: CopyId;
  locationId: Id<"partnerLocations">;
  onReset: () => void;
  onResult: (result: { type: "success" | "error"; message: string }) => void;
}) {
  const copy = useQuery(api.copies.byId, { copyId });
  const reservations = useQuery(api.reservations.byLocation, { locationId });
  const [loading, setLoading] = useState(false);

  // Note: We don't have a partner-specific pickup/checkin mutation yet,
  // so we show the actions but note what the partner would do.

  if (copy === undefined) {
    return <p className="text-muted-foreground">Loading copy details...</p>;
  }

  if (copy === null) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="font-medium">Copy not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The scanned ID &quot;{copyId}&quot; does not match any copy in the
            system.
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={onReset}>
            <ArrowLeft className="h-4 w-4" /> Scan Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Find matching reservation for this copy
  const matchingReservation = reservations?.find(
    (r) => r.copyId === copyId && r.status === "active",
  );

  const conditionLabel = copy.condition.replace("_", " ");

  return (
    <div className="space-y-4">
      {/* Copy info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Copy #{copyId.slice(-6)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge
              variant={
                copy.status === "available"
                  ? "default"
                  : copy.status === "reserved"
                    ? "secondary"
                    : "outline"
              }
              className="capitalize"
            >
              {copy.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {conditionLabel}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {copy.ownershipType}
            </Badge>
          </div>
          {copy.returnDeadline && (
            <p className="text-sm text-muted-foreground">
              Return deadline:{" "}
              {new Date(copy.returnDeadline).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Contextual actions based on status */}
      {copy.status === "reserved" && matchingReservation && (
        <ReservedActions
          copyId={copyId}
          reservationId={matchingReservation._id}
          locationId={locationId}
          condition={copy.condition}
          onReset={onReset}
          onResult={onResult}
          loading={loading}
          setLoading={setLoading}
        />
      )}

      {copy.status === "checked_out" && (
        <CheckedOutActions
          copyId={copyId}
          locationId={locationId}
          condition={copy.condition}
          onReset={onReset}
          onResult={onResult}
          loading={loading}
          setLoading={setLoading}
        />
      )}

      {copy.status === "available" && (
        <AvailableActions
          copyId={copyId}
          onReset={onReset}
        />
      )}

      {(copy.status === "damaged" ||
        copy.status === "lost" ||
        copy.status === "recalled") && (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
            <p className="font-medium capitalize">
              This copy is {copy.status.replace("_", " ")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              No actions available for copies in this state.
            </p>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" className="gap-2" onClick={onReset}>
        <ArrowLeft className="h-4 w-4" /> Scan Another
      </Button>
    </div>
  );
}

function ReservedActions({
  copyId,
  reservationId,
  locationId,
  condition,
  onReset,
  onResult,
  loading,
  setLoading,
}: {
  copyId: CopyId;
  reservationId: Id<"reservations">;
  locationId: Id<"partnerLocations">;
  condition: string;
  onReset: () => void;
  onResult: (result: { type: "success" | "error"; message: string }) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
}) {
  const pickupCopy = useMutation(api.copies.pickup);

  async function handleHandoff() {
    setLoading(true);
    try {
      await pickupCopy({
        copyId,
        locationId,
        reservationId,
        conditionAtPickup: condition,
        photos: [],
      });
      onResult({
        type: "success",
        message: `Copy #${copyId.slice(-6)} handed off successfully. Reservation fulfilled.`,
      });
      onReset();
    } catch (err: unknown) {
      onResult({
        type: "error",
        message: `Handoff failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reserved - Ready for Handoff</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This copy has an active reservation. Confirm handoff to the reader.
        </p>
        <Button
          className="w-full gap-2"
          disabled={loading}
          onClick={handleHandoff}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          Confirm Handoff
        </Button>
      </CardContent>
    </Card>
  );
}

function CheckedOutActions({
  copyId,
  locationId,
  condition,
  onReset,
  onResult,
  loading,
  setLoading,
}: {
  copyId: CopyId;
  locationId: Id<"partnerLocations">;
  condition: string;
  onReset: () => void;
  onResult: (result: { type: "success" | "error"; message: string }) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
}) {
  const returnCopy = useMutation(api.copies.returnCopy);

  async function handleCheckIn() {
    setLoading(true);
    try {
      await returnCopy({
        copyId,
        locationId,
        conditionAtReturn: condition,
        photos: [],
      });
      onResult({
        type: "success",
        message: `Copy #${copyId.slice(-6)} checked in successfully.`,
      });
      onReset();
    } catch (err: unknown) {
      onResult({
        type: "error",
        message: `Check-in failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Checked Out - Return Check-in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Reader is returning this copy. Inspect condition and confirm check-in.
        </p>
        <Button
          className="w-full gap-2"
          disabled={loading}
          onClick={handleCheckIn}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Package className="h-4 w-4" />
          )}
          Check In Book
        </Button>
      </CardContent>
    </Card>
  );
}

function AvailableActions({
  copyId,
  onReset,
}: {
  copyId: CopyId;
  onReset: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Available - On Shelf</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This copy is already on the shelf and available for readers. No action
          needed.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => {
            // Print label: in a real app, this would trigger a print dialog
            window.print();
          }}>
            Print Label
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
