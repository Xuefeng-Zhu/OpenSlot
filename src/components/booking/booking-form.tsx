"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  createConfirmBookingFormSchema,
  type ConfirmBookingFormValues,
} from "@/lib/validations/booking";
import type { InviteeQuestion } from "@/lib/validations/invitee-questions";
import {
  isTurnstileEnabled,
  TurnstileWidget,
} from "@/components/booking/turnstile-widget";

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

interface BookingFormProps {
  holdToken: string;
  expiresAt: string;
  selectedSlot: { start: string; end: string };
  eventTitle: string;
  hostName: string;
  timezone: string;
  inviteeQuestions: InviteeQuestion[];
  rescheduleToken?: string;
  initialGuest?: {
    name: string;
    email: string;
    timezone: string;
  };
  onConfirmed: (result: {
    bookingId: string;
    cancellationToken: string;
    rescheduleToken?: string;
    conferenceStatus?: string;
    conferenceUrl?: string | null;
    startAt: string;
    endAt: string;
    guestName: string;
    eventTitle: string;
  }) => void;
  onHoldExpired: () => void;
  onSlotTaken: () => void;
}

/**
 * Collects guest details and confirms either a new booking or a reschedule.
 * A stable idempotency key is generated per mounted form so retries caused by
 * network errors do not duplicate the booking mutation.
 */
export function BookingForm({
  holdToken,
  expiresAt,
  selectedSlot,
  eventTitle,
  hostName,
  timezone,
  inviteeQuestions,
  rescheduleToken,
  initialGuest,
  onConfirmed,
  onHoldExpired,
  onSlotTaken,
}: BookingFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => createIdempotencyKey());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );
  const bookingFormSchema = useMemo(
    () => createConfirmBookingFormSchema(inviteeQuestions),
    [inviteeQuestions]
  );
  const turnstileRequired = isTurnstileEnabled();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ConfirmBookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      guestName: initialGuest?.name ?? "",
      guestEmail: initialGuest?.email ?? "",
      guestTimezone: initialGuest?.timezone ?? timezone,
      notes: "",
      answers: defaultAnswerValues(inviteeQuestions),
    },
  });

  const selectedTimezone = watch("guestTimezone");
  const answers = watch("answers");
  const answerErrors = errors.answers as
    | Record<string, { message?: string }>
    | undefined;

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

  const onSubmit = async (data: ConfirmBookingFormValues) => {
    if (turnstileRequired && !turnstileToken) {
      setError("Please complete the verification challenge before continuing.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        rescheduleToken ? "/api/bookings/reschedule" : "/api/bookings",
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          ...(rescheduleToken ? { rescheduleToken } : {}),
          holdToken,
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          guestTimezone: data.guestTimezone,
          notes: data.notes || undefined,
          answers: data.answers ?? {},
          idempotencyKey,
          turnstileToken: turnstileToken ?? undefined,
        }),
        }
      );

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
          rescheduleToken: result.rescheduleToken,
          conferenceStatus: result.conferenceStatus,
          conferenceUrl: result.conferenceUrl,
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
      if (turnstileRequired) {
        setTurnstileToken(null);
        setTurnstileResetKey((key) => key + 1);
      }
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">
              {rescheduleToken ? "Confirm new time" : "Confirm your booking"}
            </CardTitle>
            <CardDescription>
              {eventTitle} with {hostName}
            </CardDescription>
          </div>
          <div
            className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${
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
        <div className="mb-6 grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <CalendarCheck className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Date
              </p>
              <p className="font-medium">{formatSlotDate(selectedSlot.start)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Time
              </p>
              <p className="font-medium">
                {formatSlotTime(selectedSlot.start)} -{" "}
                {formatSlotTime(selectedSlot.end)}
              </p>
            </div>
          </div>
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

          {inviteeQuestions.map((question) => (
            <div key={question.id} className="space-y-2">
              {question.type !== "checkbox" && (
                <Label htmlFor={`answer-${question.id}`}>
                  {question.label}
                  {question.required ? " *" : ""}
                </Label>
              )}

              {question.type === "textarea" && (
                <Textarea
                  id={`answer-${question.id}`}
                  value={(answers?.[question.id] as string | undefined) ?? ""}
                  onChange={(event) =>
                    setValue(`answers.${question.id}`, event.target.value, {
                      shouldValidate: true,
                    })
                  }
                  aria-invalid={!!answerErrors?.[question.id]}
                  aria-describedby={
                    answerErrors?.[question.id]
                      ? `answer-${question.id}-error`
                      : undefined
                  }
                />
              )}

              {question.type === "text" && (
                <Input
                  id={`answer-${question.id}`}
                  value={(answers?.[question.id] as string | undefined) ?? ""}
                  onChange={(event) =>
                    setValue(`answers.${question.id}`, event.target.value, {
                      shouldValidate: true,
                    })
                  }
                  aria-invalid={!!answerErrors?.[question.id]}
                  aria-describedby={
                    answerErrors?.[question.id]
                      ? `answer-${question.id}-error`
                      : undefined
                  }
                />
              )}

              {question.type === "select" && (
                <Select
                  value={(answers?.[question.id] as string | undefined) ?? ""}
                  onValueChange={(value) =>
                    setValue(`answers.${question.id}`, value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger
                    id={`answer-${question.id}`}
                    aria-invalid={!!answerErrors?.[question.id]}
                  >
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {question.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {question.type === "checkbox" && (
                <label
                  htmlFor={`answer-${question.id}`}
                  className="flex items-start gap-2 rounded-md border border-border p-3 text-sm"
                >
                  <input
                    id={`answer-${question.id}`}
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    checked={Boolean(answers?.[question.id])}
                    onChange={(event) =>
                      setValue(`answers.${question.id}`, event.target.checked, {
                        shouldValidate: true,
                      })
                    }
                    aria-invalid={!!answerErrors?.[question.id]}
                    aria-describedby={
                      answerErrors?.[question.id]
                        ? `answer-${question.id}-error`
                        : undefined
                    }
                  />
                  <span>
                    {question.label}
                    {question.required ? " *" : ""}
                  </span>
                </label>
              )}

              {answerErrors?.[question.id] && (
                <p
                  id={`answer-${question.id}-error`}
                  className="text-sm text-destructive"
                >
                  {answerErrors[question.id].message}
                </p>
              )}
            </div>
          ))}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
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

          <TurnstileWidget
            action={rescheduleToken ? "reschedule" : "confirm"}
            resetKey={turnstileResetKey}
            onTokenChange={setTurnstileToken}
          />

          {/* Error message */}
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={
              submitting ||
              timeRemaining <= 0 ||
              (turnstileRequired && !turnstileToken)
            }
          >
            {submitting
              ? "Confirming..."
              : rescheduleToken
                ? "Confirm New Time"
                : "Confirm Booking"}
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

function defaultAnswerValues(inviteeQuestions: InviteeQuestion[]) {
  return inviteeQuestions.reduce<Record<string, string | boolean>>(
    (values, question) => {
      values[question.id] = question.type === "checkbox" ? false : "";
      return values;
    },
    {}
  );
}
