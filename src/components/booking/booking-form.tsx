"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import {
  createConfirmBookingFormSchema,
  type ConfirmBookingFormInputValues,
  type ConfirmBookingFormValues,
} from "@/lib/validations/booking";
import { DEFAULT_TIMEZONE, validTimezoneOrNull } from "@/lib/utils/timezone";
import type { BookingAgentDraft } from "@/lib/booking-agent/types";
import type { InviteeQuestion } from "@/lib/validations/invitee-questions";
import {
  isTurnstileEnabled,
} from "@/components/booking/turnstile-widget";
import { computeRemainingSeconds } from "@/components/booking/hold-timer";
import { BookingInviteeQuestionFields } from "@/components/booking/booking-invitee-question-fields";
import {
  BookingFormHeader,
  BookingGuestContactFields,
  BookingNotesField,
  BookingSlotSummary,
  BookingSubmitSection,
} from "@/components/booking/booking-form-sections";
import { createClientIdempotencyKey } from "@/lib/idempotency/client-idempotency";
import type { BookingHeadingLevel } from "@/components/booking/booking-page-event-header";

interface BookingFormProps {
  headingLevel?: BookingHeadingLevel;
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

interface BookingMutationResponseBody {
  success?: boolean;
  error?: string;
  bookingId?: string;
  cancellationToken?: string;
  rescheduleToken?: string;
  conferenceStatus?: string;
  conferenceUrl?: string | null;
}

/**
 * Collects guest details and confirms either a new booking or a reschedule.
 * A stable idempotency key is generated per mounted form so retries caused by
 * network errors do not duplicate the booking mutation.
 */
export function BookingForm({
  headingLevel = 2,
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
  const initialGuestTimezone = pageTimezone;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => createClientIdempotencyKey());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const userEditedFieldsRef = useRef<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState<number>(
    expiresAt ? computeRemainingSeconds(expiresAt, new Date()) : 0
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
    setValue,
  ]);

  useEffect(() => {
    setValue("guestTimezone", pageTimezone, { shouldValidate: true });
  }, [pageTimezone, setValue]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) {
      setTimeRemaining(0);
      return;
    }

    const initialRemaining = computeRemainingSeconds(expiresAt, new Date());
    setTimeRemaining(initialRemaining);

    const interval = setInterval(() => {
      const remaining = computeRemainingSeconds(expiresAt, new Date());
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onHoldExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onHoldExpired]);

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

      const result = (await response
        .json()
        .catch(() => ({}))) as BookingMutationResponseBody;

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

      if (result.success && result.bookingId && result.cancellationToken) {
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
      <BookingFormHeader
        headingLevel={headingLevel}
        eventTitle={eventTitle}
        hostName={hostName}
        holdPending={holdPending}
        isRescheduling={Boolean(rescheduleToken)}
        timeRemaining={timeRemaining}
      />
      <CardContent>
        <BookingSlotSummary
          selectedSlot={selectedSlot}
          displayTimezone={displayTimezone}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("guestTimezone")} />

          <BookingGuestContactFields
            register={register}
            errors={errors}
            onUserEdited={markUserEdited}
          />

          <BookingInviteeQuestionFields
            questions={inviteeQuestions}
            answers={answers}
            answerErrors={answerErrors}
            onAnswerChange={handleAnswerChange}
          />

          <BookingNotesField
            register={register}
            errors={errors}
            onUserEdited={markUserEdited}
          />

          <BookingSubmitSection
            error={error}
            holdPending={holdPending}
            holdToken={holdToken}
            isRescheduling={Boolean(rescheduleToken)}
            submitting={submitting}
            timeRemaining={timeRemaining}
            turnstileRequired={turnstileRequired}
            turnstileResetKey={turnstileResetKey}
            turnstileToken={turnstileToken}
            onTurnstileTokenChange={setTurnstileToken}
          />
        </form>
      </CardContent>
    </Card>
  );
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
