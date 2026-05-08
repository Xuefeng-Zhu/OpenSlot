"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "America/Sao_Paulo",
  "Africa/Cairo",
  "Africa/Johannesburg",
];

/**
 * Form schema for the booking form (excludes holdToken which is passed as prop).
 */
const bookingFormSchema = z.object({
  guestName: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  guestEmail: z.string().email("Must be a valid email address"),
  guestTimezone: z.string().min(1, "Timezone is required"),
  notes: z.string().max(1000, "Notes must be 1000 characters or less").optional(),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

interface BookingFormProps {
  holdToken: string;
  expiresAt: string;
  selectedSlot: { start: string; end: string };
  eventTitle: string;
  hostName: string;
  timezone: string;
  onConfirmed: (result: {
    bookingId: string;
    cancellationToken: string;
    startAt: string;
    endAt: string;
    guestName: string;
    eventTitle: string;
  }) => void;
  onHoldExpired: () => void;
  onSlotTaken: () => void;
}

export function BookingForm({
  holdToken,
  expiresAt,
  selectedSlot,
  eventTitle,
  hostName,
  timezone,
  onConfirmed,
  onHoldExpired,
  onSlotTaken,
}: BookingFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => createIdempotencyKey());
  const [timeRemaining, setTimeRemaining] = useState<number>(
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      guestName: "",
      guestEmail: "",
      guestTimezone: timezone,
      notes: "",
    },
  });

  const selectedTimezone = watch("guestTimezone");

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onHoldExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onHoldExpired]);

  const formatCountdown = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const onSubmit = async (data: BookingFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          holdToken,
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          guestTimezone: data.guestTimezone,
          notes: data.notes || undefined,
          idempotencyKey,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 410) {
          // Hold expired
          onHoldExpired();
          return;
        }
        if (response.status === 409) {
          // Slot taken
          onSlotTaken();
          return;
        }
        setError(result.error || "Failed to confirm booking. Please try again.");
        return;
      }

      if (result.success) {
        onConfirmed({
          bookingId: result.bookingId,
          cancellationToken: result.cancellationToken,
          startAt: selectedSlot.start,
          endAt: selectedSlot.end,
          guestName: data.guestName,
          eventTitle,
        });
      } else {
        setError(result.error || "Failed to confirm booking.");
      }
    } catch {
      setError("Unable to confirm booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  function formatSlotTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: selectedTimezone || timezone || undefined,
    });
  }

  function formatSlotDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: selectedTimezone || timezone || undefined,
    });
  }

  // Ensure the timezone list includes the current timezone
  const timezoneOptions = COMMON_TIMEZONES.includes(timezone)
    ? COMMON_TIMEZONES
    : [timezone, ...COMMON_TIMEZONES];

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Confirm Your Booking</CardTitle>
            <CardDescription>
              {eventTitle} with {hostName}
            </CardDescription>
          </div>
          <div
            className={`text-sm font-medium px-3 py-1 rounded-full ${
              timeRemaining <= 60
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            }`}
            role="timer"
            aria-label={`Hold expires in ${formatCountdown(timeRemaining)}`}
          >
            Hold expires in {formatCountdown(timeRemaining)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Slot summary */}
        <div className="mb-6 p-3 bg-muted rounded-md">
          <p className="font-medium">{formatSlotDate(selectedSlot.start)}</p>
          <p className="text-sm text-muted-foreground">
            {formatSlotTime(selectedSlot.start)} –{" "}
            {formatSlotTime(selectedSlot.end)}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Guest Name */}
          <div className="space-y-2">
            <Label htmlFor="guestName">Name *</Label>
            <Input
              id="guestName"
              placeholder="Your full name"
              {...register("guestName")}
              aria-invalid={!!errors.guestName}
              aria-describedby={errors.guestName ? "guestName-error" : undefined}
            />
            {errors.guestName && (
              <p id="guestName-error" className="text-sm text-destructive">
                {errors.guestName.message}
              </p>
            )}
          </div>

          {/* Guest Email */}
          <div className="space-y-2">
            <Label htmlFor="guestEmail">Email *</Label>
            <Input
              id="guestEmail"
              type="email"
              placeholder="you@example.com"
              {...register("guestEmail")}
              aria-invalid={!!errors.guestEmail}
              aria-describedby={
                errors.guestEmail ? "guestEmail-error" : undefined
              }
            />
            {errors.guestEmail && (
              <p id="guestEmail-error" className="text-sm text-destructive">
                {errors.guestEmail.message}
              </p>
            )}
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="guestTimezone">Timezone</Label>
            <Select
              value={selectedTimezone}
              onValueChange={(value) => setValue("guestTimezone", value)}
            >
              <SelectTrigger id="guestTimezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.guestTimezone && (
              <p className="text-sm text-destructive">
                {errors.guestTimezone.message}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Anything you'd like the host to know..."
              {...register("notes")}
              aria-invalid={!!errors.notes}
              aria-describedby={errors.notes ? "notes-error" : undefined}
            />
            {errors.notes && (
              <p id="notes-error" className="text-sm text-destructive">
                {errors.notes.message}
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || timeRemaining <= 0}
          >
            {submitting ? "Confirming..." : "Confirm Booking"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
