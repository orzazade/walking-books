"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, X, Keyboard } from "lucide-react";
import { useScanner } from "@/components/use-scanner";

interface IsbnScannerProps {
  onScan: (isbn: string) => void;
}

export function IsbnScanner({ onScan }: IsbnScannerProps) {
  const [manualIsbn, setManualIsbn] = useState("");

  const onDecode = useCallback((decodedText: string): string | null => {
    const cleaned = decodedText.replace(/[^0-9X]/gi, "");
    return cleaned.length === 10 || cleaned.length === 13 ? cleaned : null;
  }, []);

  const qrbox = useMemo(() => ({ width: 250, height: 150 }), []);

  const { mode, setMode, error, scannerRef, stopScanner } = useScanner({
    regionId: "isbn-scanner-region",
    qrbox,
    onDecode,
    onResult: onScan,
    cameraErrorMessage:
      "Could not access camera. Please allow camera permissions or enter ISBN manually.",
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
          Scan Barcode with Camera
        </Button>
        <Button
          variant="outline"
          className="h-20 gap-2"
          onClick={() => setMode("manual")}
        >
          <Keyboard className="h-5 w-5" />
          Enter ISBN Manually
        </Button>
      </div>
    );
  }

  if (mode === "camera") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Point your camera at the barcode on the back of the book
          </p>
          <Button variant="ghost" size="sm" onClick={() => { stopScanner(); setMode("choose"); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Card>
          <CardContent className="p-2">
            <div id="isbn-scanner-region" ref={scannerRef} className="w-full" />
          </CardContent>
        </Card>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          variant="link"
          size="sm"
          onClick={() => { stopScanner(); setMode("manual"); }}
        >
          Enter manually instead
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Enter the 10 or 13 digit ISBN
        </p>
        <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="e.g. 9780141036144"
          value={manualIsbn}
          onChange={(e) => setManualIsbn(e.target.value.replace(/[^0-9X]/gi, ""))}
          maxLength={13}
        />
        <Button
          onClick={() => {
            if (manualIsbn.length === 10 || manualIsbn.length === 13) {
              onScan(manualIsbn);
            }
          }}
          disabled={manualIsbn.length !== 10 && manualIsbn.length !== 13}
        >
          Look Up
        </Button>
      </div>
    </div>
  );
}
