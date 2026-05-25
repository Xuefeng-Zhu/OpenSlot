"use client";

import { CalendarCheck, Clock3 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatRemainingSeconds } from "@/components/booking/hold-timer";
import { TurnstileWidget } from "@/components/booking/turnstile-widget";
import type { ConfirmBookingFormInputValues } from "@/lib/validations/booking";
import {
  formatBookingDate,
  formatBookingTime,
} from "@/lib/booking/date-time-format";

interface SelectedSlotSummary {
  start: string;
  end: string;
}

export function BookingFormHeader({
  eventTitle,
  hostName,
  holdPending,
  isRescheduling,
  timeRemaining,
}: {
  eventTitle: string;
  hostName: string;
  holdPending: boolean;
  isRescheduling: boolean;
  timeRemaining: number;
}) {
  return (
    <CardHeader>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">
            {isRescheduling ? "Confirm new time" : "Confirm your booking"}
          </CardTitle>
          <CardDescription>
            {eventTitle} with {hostName}
          </CardDescription>
        </div>
        {holdPending ? (
          <div
            className="w-fit rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground"
            role="status"
          >
            Securing time...
          </div>
        ) : (
          <div
            className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${
              timeRemaining <= 60
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            }`}
            role="timer"
            aria-label={`Hold expires in ${formatRemainingSeconds(timeRemaining)}`}
          >
            Hold expires in {formatRemainingSeconds(timeRemaining)}
          </div>
        )}
      </div>
    </CardHeader>
  );
}

export function BookingSlotSummary({
  selectedSlot,
  displayTimezone,
}: {
  selectedSlot: SelectedSlotSummary;
  displayTimezone: string;
}) {
  return (
    <div className="mb-6 grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
      <div className="flex items-start gap-3">
        <CalendarCheck className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Date
          </p>
          <p className="font-medium">
            {formatBookingDate(selectedSlot.start, displayTimezone)}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Clock3 className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Time
          </p>
          <p className="font-medium">
            {formatBookingTime(selectedSlot.start, displayTimezone)} -{" "}
            {formatBookingTime(selectedSlot.end, displayTimezone)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function BookingGuestContactFields({
  errors,
  register,
  onUserEdited,
}: {
  errors: FieldErrors<ConfirmBookingFormInputValues>;
  register: UseFormRegister<ConfirmBookingFormInputValues>;
  onUserEdited: (field: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="guestName">Name *</Label>
        <Input
          id="guestName"
          placeholder="Your full name"
          {...register("guestName", {
            onChange: () => onUserEdited("guestName"),
          })}
          aria-invalid={!!errors.guestName}
          aria-describedby={errors.guestName ? "guestName-error" : undefined}
        />
        {errors.guestName && (
          <p id="guestName-error" className="text-sm text-destructive">
            {errors.guestName.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="guestEmail">Email *</Label>
        <Input
          id="guestEmail"
          type="email"
          placeholder="you@example.com"
          {...register("guestEmail", {
            onChange: () => onUserEdited("guestEmail"),
          })}
          aria-invalid={!!errors.guestEmail}
          aria-describedby={errors.guestEmail ? "guestEmail-error" : undefined}
        />
        {errors.guestEmail && (
          <p id="guestEmail-error" className="text-sm text-destructive">
            {errors.guestEmail.message}
          </p>
        )}
      </div>
    </>
  );
}

export function BookingNotesField({
  errors,
  register,
  onUserEdited,
}: {
  errors: FieldErrors<ConfirmBookingFormInputValues>;
  register: UseFormRegister<ConfirmBookingFormInputValues>;
  onUserEdited: (field: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="notes">Notes (optional)</Label>
      <Textarea
        id="notes"
        placeholder="Anything you'd like the host to know..."
        {...register("notes", {
          onChange: () => onUserEdited("notes"),
        })}
        aria-invalid={!!errors.notes}
        aria-describedby={errors.notes ? "notes-error" : undefined}
      />
      {errors.notes && (
        <p id="notes-error" className="text-sm text-destructive">
          {errors.notes.message}
        </p>
      )}
    </div>
  );
}

export function BookingSubmitSection({
  error,
  holdPending,
  holdToken,
  isRescheduling,
  submitting,
  timeRemaining,
  turnstileRequired,
  turnstileResetKey,
  turnstileToken,
  onTurnstileTokenChange,
}: {
  error: string | null;
  holdPending: boolean;
  holdToken?: string;
  isRescheduling: boolean;
  submitting: boolean;
  timeRemaining: number;
  turnstileRequired: boolean;
  turnstileResetKey: number;
  turnstileToken: string | null;
  onTurnstileTokenChange: (token: string | null) => void;
}) {
  return (
    <>
      <TurnstileWidget
        action={isRescheduling ? "reschedule" : "confirm"}
        resetKey={turnstileResetKey}
        onTokenChange={onTurnstileTokenChange}
      />

      {error && (
        <div
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={
          submitting ||
          holdPending ||
          !holdToken ||
          timeRemaining <= 0 ||
          (turnstileRequired && !turnstileToken)
        }
      >
        {submitting
          ? "Confirming..."
          : holdPending
            ? "Securing Time..."
            : isRescheduling
              ? "Confirm New Time"
              : "Confirm Booking"}
      </Button>
    </>
  );
}
