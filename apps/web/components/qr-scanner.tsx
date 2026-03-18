"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, X, Keyboard } from "lucide-react";
import { useScanner } from "@/components/use-scanner";

interface QrScannerProps {
  onScan: (copyId: string) => void;
}

export function QrScanner({ onScan }: QrScannerProps) {
  const [manualId, setManualId] = useState("");

  const onDecode = useCallback((decodedText: string): string | null => {
    // Try to extract copy ID from a URL like /copy/abc123
    try {
      const url = new URL(decodedText);
      const pathParts = url.pathname.split("/");
      const copyIndex = pathParts.indexOf("copy");
      if (copyIndex !== -1 && pathParts[copyIndex + 1]) {
        return pathParts[copyIndex + 1];
      }
    } catch {
      // Not a URL, treat as raw ID
    }
    // Return raw text if it looks like an ID (non-empty, no spaces)
    const trimmed = decodedText.trim();
    if (trimmed && !trimmed.includes(" ")) {
      return trimmed;
    }
    return null;
  }, []);

  const qrbox = useMemo(() => ({ width: 250, height: 250 }), []);

  const { mode, setMode, error, scannerRef, stopScanner } = useScanner({
    regionId: "qr-scanner-region",
    qrbox,
    onDecode,
    onResult: onScan,
    cameraErrorMessage:
      "Could not access camera. Please allow camera permissions or enter copy ID manually.",
  });

  if (mode === "choose") {
    return (
      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          className="h-20 gap-2"
          onClick={() => setMode("camera")}
        >
          <Camera className="h-5 w-5" />
          Scan QR Code with Camera
        </Button>
        <Button
          variant="outline"
          className="h-20 gap-2"
          onClick={() => setMode("manual")}
        >
          <Keyboard className="h-5 w-5" />
          Enter Copy ID Manually
        </Button>
      </div>
    );
  }

  if (mode === "camera") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Point your camera at the QR code on the book
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              stopScanner();
              setMode("choose");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Card>
          <CardContent className="p-2">
            <div id="qr-scanner-region" ref={scannerRef} className="w-full" />
          </CardContent>
        </Card>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          variant="link"
          size="sm"
          onClick={() => {
            stopScanner();
            setMode("manual");
          }}
        >
          Enter ID manually instead
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Enter the copy ID</p>
        <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="e.g. k57abc123def..."
          value={manualId}
          onChange={(e) => setManualId(e.target.value.trim())}
        />
        <Button
          onClick={() => {
            if (manualId.length > 0) {
              onScan(manualId);
            }
          }}
          disabled={manualId.length === 0}
        >
          Look Up
        </Button>
      </div>
    </div>
  );
}
