"use client";

import { useState, useEffect } from "react";

interface ReservationTimerProps {
  expiresAt: number;
}

export function ReservationTimer({ expiresAt }: ReservationTimerProps) {
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.max(0, expiresAt - Date.now());
      setRemaining(diff);
      if (diff <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isLow = minutes < 10;

  if (remaining <= 0) {
    return <span className="text-sm font-medium text-destructive">Expired</span>;
  }

  return (
    <span
      className={`text-sm font-mono font-medium ${
        isLow ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
