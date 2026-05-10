"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TimeSlotButtonProps {
  time: string;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

const TimeSlotButton = React.forwardRef<HTMLButtonElement, TimeSlotButtonProps>(
  ({ time, selected = false, disabled = false, loading = false, onClick, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        onClick={onClick}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
          "min-h-[44px] min-w-[44px] px-4 py-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "ring-offset-background",
          selected
            ? "bg-primary text-primary-foreground border-primary border"
            : "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
          (disabled || loading) && "opacity-50 cursor-not-allowed"
        )}
        aria-pressed={selected}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="sr-only">Holding {time}</span>
          </>
        ) : (
          <span>{time}</span>
        )}
      </button>
    );
  }
);

TimeSlotButton.displayName = "TimeSlotButton";

export { TimeSlotButton };
