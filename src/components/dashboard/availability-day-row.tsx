"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface TimeInterval {
  id?: string;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface AvailabilityDayRowProps {
  day: string; // "Monday", "Tuesday", etc.
  enabled: boolean;
  intervals: TimeInterval[];
  onToggle: (enabled: boolean) => void;
  onIntervalsChange: (intervals: TimeInterval[]) => void;
  error?: string;
}

/**
 * Validates a time interval.
 * Returns an error message if end <= start, null otherwise.
 * Compares as "HH:mm" strings (lexicographic comparison works for 24h format).
 */
export function validateTimeInterval(
  start: string,
  end: string
): string | null {
  if (!start || !end) {
    return null;
  }
  if (end <= start) {
    return "End time must be after start time";
  }
  return null;
}

export function AvailabilityDayRow({
  day,
  enabled,
  intervals,
  onToggle,
  onIntervalsChange,
  error,
}: AvailabilityDayRowProps) {
  const handleAddInterval = () => {
    onIntervalsChange([...intervals, { start: "", end: "" }]);
  };

  const handleRemoveInterval = (index: number) => {
    onIntervalsChange(intervals.filter((_, i) => i !== index));
  };

  const handleIntervalChange = (
    index: number,
    field: "start" | "end",
    value: string
  ) => {
    const updated = intervals.map((interval, i) =>
      i === index ? { ...interval, [field]: value } : interval
    );
    onIntervalsChange(updated);
  };

  return (
    <div
      className={cn(
        "space-y-3 rounded-md border border-border bg-card p-3",
        !enabled && "opacity-70"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            aria-label={`Toggle ${day} availability`}
          />
          <span className="text-sm font-medium">{day}</span>
        </div>
        {enabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddInterval}
            aria-label={`Add interval for ${day}`}
          >
            <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
            Add interval
          </Button>
        )}
      </div>

      {enabled && (
        <div className="space-y-2 sm:pl-14">
          {intervals.map((interval, index) => {
            const validationError = validateTimeInterval(
              interval.start,
              interval.end
            );
            return (
              <div key={interval.id ?? `${day}-${index}`} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="time"
                    value={interval.start}
                    onChange={(e) =>
                      handleIntervalChange(index, "start", e.target.value)
                    }
                    className="w-[8.5rem]"
                    aria-label={`Start time for ${day} interval ${index + 1}`}
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={interval.end}
                    onChange={(e) =>
                      handleIntervalChange(index, "end", e.target.value)
                    }
                    className="w-[8.5rem]"
                    aria-label={`End time for ${day} interval ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveInterval(index)}
                    aria-label={`Remove interval ${index + 1} for ${day}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
                {validationError && (
                  <p className="text-xs text-destructive" role="alert">
                    {validationError}
                  </p>
                )}
              </div>
            );
          })}
          {intervals.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No intervals set. Click &quot;Add interval&quot; to add one.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive pl-14" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
