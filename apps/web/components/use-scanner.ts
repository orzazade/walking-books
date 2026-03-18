"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface UseScannerOptions {
  regionId: string;
  qrbox: { width: number; height: number };
  onDecode: (decodedText: string) => string | null;
  onResult: (value: string) => void;
  cameraErrorMessage: string;
}

export function useScanner({
  regionId,
  qrbox,
  onDecode,
  onResult,
  cameraErrorMessage,
}: UseScannerOptions) {
  const [mode, setMode] = useState<"choose" | "camera" | "manual">("choose");
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // scanner may already be stopped
      }
      html5QrCodeRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(regionId);
      html5QrCodeRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox },
        (decodedText) => {
          const value = onDecode(decodedText);
          if (value) {
            stopScanner();
            onResult(value);
          }
        },
        () => {
          // ignore scan failures
        },
      );
    } catch {
      setError(cameraErrorMessage);
      setMode("manual");
    }
  }, [regionId, qrbox, onDecode, onResult, cameraErrorMessage, stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  useEffect(() => {
    if (mode === "camera") {
      startScanner();
    }
    return () => {
      if (mode === "camera") {
        stopScanner();
      }
    };
  }, [mode, startScanner, stopScanner]);

  return { mode, setMode, error, scannerRef, stopScanner };
}
