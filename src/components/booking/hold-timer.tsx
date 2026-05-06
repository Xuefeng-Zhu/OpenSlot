"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface HoldTimerProps {
  expiresAt: string; // ISO timestamp
  onExpired: () => void;
}

/**
 * Computes the remaining seconds until expiration.
 * Returns max(0, floor((expiresAt - now) / 1000))
 */
export function computeRemainingSeconds(expiresAt: string, now: Date): number {
  return Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000)
  );
}

/**
 * Formats seconds into a display string.
 * If >= 60 seconds, displays as "M:SS" (e.g., "2:05").
 * If < 60 seconds, displays as "0:SS" (e.g., "0:42").
 */
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

const HoldTimer = React.forwardRef<HTMLDivElement, HoldTimerProps>(
  ({ expiresAt, onExpired }, ref) => {
    const [remaining, setRemaining] = React.useState(() =>
      computeRemainingSeconds(expiresAt, new Date())
    );

    const onExpiredRef = React.useRef(onExpired);
    onExpiredRef.current = onExpired;

    React.useEffect(() => {
      const initial = computeRemainingSeconds(expiresAt, new Date());
      setRemaining(initial);

      if (initial <= 0) {
        onExpiredRef.current();
        return;
      }

      const interval = setInterval(() => {
        const now = new Date();
        const secs = computeRemainingSeconds(expiresAt, now);
        setRemaining(secs);

        if (secs <= 0) {
          clearInterval(interval);
          onExpiredRef.current();
        }
      }, 1000);

      return () => clearInterval(interval);
    }, [expiresAt]);

    const isWarning = remaining <= 30;

    return (
      <div
        ref={ref}
        role="timer"
        aria-live="polite"
        aria-label={`Hold expires in ${formatTime(remaining)}`}
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium",
          isWarning
            ? "bg-warning/10 text-warning"
            : "bg-muted text-muted-foreground"
        )}
      >
        <svg
          className="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>{formatTime(remaining)}</span>
      </div>
    );
  }
);

HoldTimer.displayName = "HoldTimer";

export { HoldTimer };
