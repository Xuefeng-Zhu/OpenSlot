"use client";

import { format } from "date-fns";
import { AlertCircle, CalendarDays, Clock3 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeSlotButton } from "@/components/booking/time-slot-button";
import { TurnstileWidget } from "@/components/booking/turnstile-widget";
import type { TimeSlot } from "@/lib/availability/types";
import { cn } from "@/lib/utils";

interface SlotSelectionGridProps {
  layout: "public" | "embedded";
  selectedDate: Date | undefined;
  loading: boolean;
  error: string | null;
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  holdLoading: boolean;
  holdTurnstileToken: string | null;
  holdTurnstileResetKey: number;
  turnstileRequired: boolean;
  onDateSelect: (date: Date | undefined) => void;
  onRetrySlots: () => void;
  onSlotSelect: (slot: TimeSlot) => void;
  onHoldTurnstileTokenChange: (token: string | null) => void;
  formatSlotTime: (isoString: string) => string;
}

export function SlotSelectionGrid({
  layout,
  selectedDate,
  loading,
  error,
  slots,
  selectedSlot,
  holdLoading,
  holdTurnstileToken,
  holdTurnstileResetKey,
  turnstileRequired,
  onDateSelect,
  onRetrySlots,
  onSlotSelect,
  onHoldTurnstileTokenChange,
  formatSlotTime,
}: SlotSelectionGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6",
        layout === "public" && "md:grid-cols-2"
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select a date</CardTitle>
          <CardDescription>Choose a date to see available times</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={onDateSelect}
            disabled={(date) =>
              date < new Date(new Date().setHours(0, 0, 0, 0))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available times</CardTitle>
          <CardDescription>
            {selectedDate
              ? format(selectedDate, "EEEE, MMMM d, yyyy")
              : "Select a date to view available times"}
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          {!selectedDate && !error && (
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
              heading="Choose a date"
              description="Pick an available date from the calendar to see times in your timezone."
              className="border-0 bg-muted/30 py-10"
            />
          )}

          {selectedDate && loading && (
            <div
              className="flex items-center justify-center rounded-lg bg-muted/30 py-10"
              role="status"
            >
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading available slots...
              </span>
            </div>
          )}

          {!loading && error && (
            <div
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-8 text-center"
              role="alert"
            >
              <AlertCircle
                className="mx-auto h-6 w-6 text-destructive"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onRetrySlots}
              >
                {selectedDate ? "Try Again" : "Dismiss"}
              </Button>
            </div>
          )}

          {selectedDate && !loading && !error && slots.length === 0 && (
            <EmptyState
              icon={<Clock3 className="h-6 w-6" aria-hidden="true" />}
              heading="No slots on this date"
              description="Try another date on the calendar to find a time that works."
              className="border-0 bg-muted/30 py-10"
            />
          )}

          {selectedDate && !loading && !error && slots.length > 0 && (
            <div className="space-y-3">
              <TurnstileWidget
                action="hold"
                resetKey={holdTurnstileResetKey}
                onTokenChange={onHoldTurnstileTokenChange}
              />
              <div className="grid max-h-[400px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                {slots.map((slot) => (
                  <TimeSlotButton
                    key={slot.start}
                    time={formatSlotTime(slot.start)}
                    selected={selectedSlot?.start === slot.start}
                    onClick={() => onSlotSelect(slot)}
                    disabled={
                      holdLoading || (turnstileRequired && !holdTurnstileToken)
                    }
                    loading={holdLoading && selectedSlot?.start === slot.start}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
