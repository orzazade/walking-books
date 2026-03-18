"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface ConditionPhotoCaptureProps {
  onCapture: (dataUrl: string) => void;
  photos: string[];
  maxPhotos?: number;
}

export function ConditionPhotoCapture({
  onCapture,
  photos,
  maxPhotos = 3,
}: ConditionPhotoCaptureProps) {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStreaming(true);
    } catch {
      setError("Could not access camera. Please check permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    onCapture(dataUrl);
    stopCamera();
  }, [onCapture, stopCamera]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, i) => (
          <div
            key={i}
            className="relative h-20 w-20 overflow-hidden rounded-md bg-muted"
          >
            <img
              src={photo}
              alt={`Photo ${i + 1}`}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      {streaming ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg"
          />
          <div className="flex gap-2">
            <Button onClick={capture} className="flex-1 gap-1">
              <Camera className="h-4 w-4" /> Capture
            </Button>
            <Button variant="outline" onClick={stopCamera}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        photos.length < maxPhotos && (
          <Button variant="outline" className="gap-1" onClick={startCamera}>
            <Camera className="h-4 w-4" />
            {photos.length === 0 ? "Take Photo" : "Add Another Photo"}
          </Button>
        )
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
