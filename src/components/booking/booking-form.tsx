"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useForm, type Resolver } from "react-hook-form";
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
  type ConfirmBookingFormInputValues,
  type ConfirmBookingFormValues,
} from "@/lib/validations/booking";
import {
  DEFAULT_TIMEZONE,
  timezoneOptionsWithCurrent,
  validTimezoneOrNull,
} from "@/lib/utils/timezone";
import type { BookingAgentDraft } from "@/lib/booking-agent/types";
import type { InviteeQuestion } from "@/lib/validations/invitee-questions";
import {
  isTurnstileEnabled,
  TurnstileWidget,
} from "@/components/booking/turnstile-widget";
import { BookingInviteeQuestionFields } from "@/components/booking/booking-invitee-question-fields";

interface BookingFormProps {
  holdToken?: string;
  expiresAt?: string;
  holdPending?: boolean;
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
  initialDraft?: BookingAgentDraft;
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
  holdPending = false,
  selectedSlot,
  eventTitle,
  hostName,
  timezone,
  inviteeQuestions,
  rescheduleToken,
  initialGuest,
  initialDraft,
  onConfirmed,
  onHoldExpired,
  onSlotTaken,
}: BookingFormProps) {
  const pageTimezone = validTimezoneOrNull(timezone) ?? DEFAULT_TIMEZONE;
  const initialGuestTimezone =
    validTimezoneOrNull(initialGuest?.timezone) ??
    validTimezoneOrNull(initialDraft?.guestTimezone) ??
    pageTimezone;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => createIdempotencyKey());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const userEditedFieldsRef = useRef<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState<number>(
    expiresAt
      ? Math.max(
          0,
          Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
        )
      : 0
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
  } = useForm<ConfirmBookingFormInputValues, unknown, ConfirmBookingFormValues>({
    resolver: zodResolver(bookingFormSchema) as Resolver<
      ConfirmBookingFormInputValues,
      unknown,
      ConfirmBookingFormValues
    >,
    defaultValues: {
      guestName: initialGuest?.name ?? initialDraft?.guestName ?? "",
      guestEmail: initialGuest?.email ?? initialDraft?.guestEmail ?? "",
      guestTimezone: initialGuestTimezone,
      notes: initialDraft?.notes ?? "",
      answers: {
        ...defaultAnswerValues(inviteeQuestions),
        ...(initialDraft?.answers ?? {}),
      },
    },
  });

  const selectedTimezone = watch("guestTimezone");
  const displayTimezone = validTimezoneOrNull(selectedTimezone) ?? pageTimezone;
  const answers = watch("answers");
  const answerErrors = errors.answers as
    | Record<string, { message?: string }>
    | undefined;

  useEffect(() => {
    if (!initialDraft) return;
    const hasUserEdited = (field: string) =>
      userEditedFieldsRef.current.has(field);

    if (
      !initialGuest?.name &&
      initialDraft.guestName &&
      !hasUserEdited("guestName")
    ) {
      setValue("guestName", initialDraft.guestName, { shouldValidate: true });
    }

    if (
      !initialGuest?.email &&
      initialDraft.guestEmail &&
      !hasUserEdited("guestEmail")
    ) {
      setValue("guestEmail", initialDraft.guestEmail, { shouldValidate: true });
    }

    const draftTimezone = validTimezoneOrNull(initialDraft.guestTimezone);
    if (
      !initialGuest?.timezone &&
      draftTimezone &&
      !hasUserEdited("guestTimezone")
    ) {
      setValue("guestTimezone", draftTimezone, { shouldValidate: true });
    }

    if (initialDraft.notes !== undefined && !hasUserEdited("notes")) {
      setValue("notes", initialDraft.notes, { shouldValidate: true });
    }

    for (const [questionId, answer] of Object.entries(
      initialDraft.answers ?? {}
    )) {
      if (!hasUserEdited(`answers.${questionId}`)) {
        setValue(`answers.${questionId}`, answer, { shouldValidate: true });
      }
    }
  }, [
    initialDraft,
    initialGuest?.email,
    initialGuest?.name,
    initialGuest?.timezone,
    setValue,
  ]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) {
      setTimeRemaining(0);
      return;
    }

    const initialRemaining = Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    );
    setTimeRemaining(initialRemaining);

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
    if (!holdToken) {
      setError("We are still securing this time. Please try again in a moment.");
      return;
    }

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
      timeZone: displayTimezone,
    });
  }

  function formatSlotDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: displayTimezone,
    });
  }

  // Ensure the timezone list includes the current timezone
  const timezoneOptions = timezoneOptionsWithCurrent(
    initialGuestTimezone,
    pageTimezone
  );
  const markUserEdited = useCallback((field: string) => {
    userEditedFieldsRef.current.add(field);
  }, []);
  const handleAnswerChange = useCallback(
    (questionId: string, value: string | boolean) => {
      markUserEdited(`answers.${questionId}`);
      setValue(`answers.${questionId}`, value, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [markUserEdited, setValue]
  );

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
              aria-label={`Hold expires in ${formatCountdown(timeRemaining)}`}
            >
              Hold expires in {formatCountdown(timeRemaining)}
            </div>
          )}
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
              {...register("guestName", {
                onChange: () => markUserEdited("guestName"),
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

          {/* Guest Email */}
          <div className="space-y-2">
            <Label htmlFor="guestEmail">Email *</Label>
            <Input
              id="guestEmail"
              type="email"
              placeholder="you@example.com"
              {...register("guestEmail", {
                onChange: () => markUserEdited("guestEmail"),
              })}
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
              onValueChange={(value) => {
                markUserEdited("guestTimezone");
                setValue("guestTimezone", value, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
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

          <BookingInviteeQuestionFields
            questions={inviteeQuestions}
            answers={answers}
            answerErrors={answerErrors}
            onAnswerChange={handleAnswerChange}
          />

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Anything you'd like the host to know..."
              {...register("notes", {
                onChange: () => markUserEdited("notes"),
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
