"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { addDays, format } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookingForm } from "@/components/booking/booking-form";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { TimeSlotButton } from "@/components/booking/time-slot-button";
import { BookingAgentPanel } from "@/components/booking/booking-agent-panel";
import {
  isTurnstileEnabled,
  TurnstileWidget,
} from "@/components/booking/turnstile-widget";
import { EmptyState } from "@/components/shared/empty-state";
import { BookingPageEventHeader } from "@/components/booking/booking-page-event-header";
import { cn } from "@/lib/utils";
import {
  browserTimezoneOrDefault,
  DEFAULT_TIMEZONE,
  timezoneOptionsWithCurrent,
} from "@/lib/utils/timezone";
import type { BookingAgentDraft } from "@/lib/booking-agent/types";
import type { InviteeQuestion } from "@/lib/validations/invitee-questions";

interface TimeSlot {
  start: string;
  end: string;
  slotToken?: string;
}

export interface SlotPickerEventType {
  id: string;
  title: string;
  slug: string;
  description: string;
  duration_minutes: number;
  location_type: string;
  location_value?: string | null;
  video_provider?: string | null;
  invitee_questions: InviteeQuestion[];
  user_id: string;
}

export interface SlotPickerHostProfile {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
}

interface SlotPickerProps {
  eventType: SlotPickerEventType;
  hostProfile: SlotPickerHostProfile;
  layout?: "public" | "embedded";
  bookingAgentEnabled?: boolean;
  rescheduleContext?: {
    token: string;
    guestName: string;
    guestEmail: string;
    guestTimezone: string;
    currentStartAt: string;
    currentEndAt: string;
  };
}

interface HoldInfo {
  holdToken: string;
  expiresAt: string;
}

interface BookingResult {
  bookingId: string;
  cancellationToken: string;
  rescheduleToken?: string;
  conferenceStatus?: string;
  conferenceUrl?: string | null;
  startAt: string;
  endAt: string;
  guestName: string;
  eventTitle: string;
}

type SlotsByDate = Record<string, TimeSlot[]>;

interface FetchSlotsOptions {
  force?: boolean;
}

type BookingFlowState =
  | { step: "select-slot" }
  | { step: "booking-form"; hold: HoldInfo | null; slot: TimeSlot }
  | { step: "confirmed"; booking: BookingResult };

const SLOT_PREFETCH_DAYS = 60;

/**
 * Public booking flow for choosing a date/time, creating a short-lived hold, and
 * rendering the booking or reschedule form. Slot and hold failures refresh the
 * available-slot list so guests do not continue from stale availability.
 */
export function SlotPicker({
  eventType,
  hostProfile,
  layout = "public",
  bookingAgentEnabled = false,
  rescheduleContext,
}: SlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [timezoneReady, setTimezoneReady] = useState(false);
  const [slotsByDate, setSlotsByDate] = useState<SlotsByDate>({});
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [holdLoading, setHoldLoading] = useState(false);
  const [holdTurnstileToken, setHoldTurnstileToken] = useState<string | null>(
    null
  );
  const [holdTurnstileResetKey, setHoldTurnstileResetKey] = useState(0);
  const [agentDraft, setAgentDraft] = useState<BookingAgentDraft>({});
  const holdIdempotencyKeysRef = useRef<Map<string, string>>(new Map());
  const [flowState, setFlowState] = useState<BookingFlowState>({
    step: "select-slot",
  });
  const turnstileRequired = isTurnstileEnabled();
  const selectedDateString = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : undefined;
  const showBookingAgent = bookingAgentEnabled && layout === "public";

  useEffect(() => {
    setTimezone(browserTimezoneOrDefault());
    setTimezoneReady(true);
  }, []);

  const fetchSlotWindow = useCallback(
    async (anchorDate: Date, tz: string, applyDate?: Date) => {
      const startDate = format(anchorDate, "yyyy-MM-dd");
      const endDate = format(
        addDays(anchorDate, SLOT_PREFETCH_DAYS - 1),
        "yyyy-MM-dd"
      );
      const applyDateString = applyDate
        ? format(applyDate, "yyyy-MM-dd")
        : null;
      const shouldApply = Boolean(applyDateString);

      if (shouldApply) {
        setLoading(true);
        setError(null);
        setSlots([]);
        setSelectedSlot(null);
      }

      try {
        const params = new URLSearchParams({
          hostUserId: hostProfile.id,
          eventTypeId: eventType.id,
          startDate,
          endDate,
          timezone: tz,
        });

        const response = await fetch(`/api/slots?${params.toString()}`);

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          if (shouldApply) {
            setError(
              data?.error || "Failed to fetch available slots. Please try again."
            );
          }
          return;
        }

        const data = await response.json();
        const nextSlotsByDate = (data.slotsByDate ?? {}) as SlotsByDate;

        setSlotsByDate((current) => ({
          ...current,
          ...nextSlotsByDate,
        }));

        if (applyDateString) {
          setSlots(nextSlotsByDate[applyDateString] ?? []);
        }
      } catch {
        if (shouldApply) {
          setError(
            "Unable to load available slots. The service may be temporarily unavailable."
          );
        }
      } finally {
        if (shouldApply) {
          setLoading(false);
        }
      }
    },
    [hostProfile.id, eventType.id]
  );

  const fetchSlots = useCallback(
    async (date: Date, tz: string, options: FetchSlotsOptions = {}) => {
      const dateStr = format(date, "yyyy-MM-dd");

      if (!options.force && hasSlotsForDate(slotsByDate, dateStr)) {
        setError(null);
        setSlots(slotsByDate[dateStr] ?? []);
        setSelectedSlot(null);
        setLoading(false);
        return;
      }

      await fetchSlotWindow(date, tz, date);
    },
    [fetchSlotWindow, slotsByDate]
  );

  useEffect(() => {
    if (timezoneReady && timezone) {
      void fetchSlotWindow(new Date(), timezone);
    }
  }, [timezoneReady, timezone, fetchSlotWindow]);

  useEffect(() => {
    if (timezoneReady && selectedDate && timezone) {
      fetchSlots(selectedDate, timezone);
    }
  }, [selectedDate, timezone, timezoneReady, fetchSlots]);

  function handleDateSelect(date: Date | undefined) {
    setSelectedDate(date);
    setSelectedSlot(null);
    // Reset flow state when changing date
    if (flowState.step !== "confirmed") {
      setFlowState({ step: "select-slot" });
    }
  }

  function handleTimezoneChange(tz: string) {
    setTimezone(tz);
    setSlotsByDate({});
    setSlots([]);
    setSelectedSlot(null);
    // Reset flow state when changing timezone
    if (flowState.step !== "confirmed") {
      setFlowState({ step: "select-slot" });
    }
  }

  async function handleSlotSelect(slot: TimeSlot) {
    if (turnstileRequired && !holdTurnstileToken) {
      setError("Please complete the verification challenge before selecting a time.");
      return;
    }

    setSelectedSlot(slot);
    setHoldLoading(true);
    setError(null);
    setFlowState({
      step: "booking-form",
      hold: null,
      slot,
    });
    const holdKey = holdIdempotencyKeyForSlot(slot);
    const idempotencyKey =
      holdIdempotencyKeysRef.current.get(holdKey) ?? createIdempotencyKey();
    holdIdempotencyKeysRef.current.set(holdKey, idempotencyKey);

    try {
      // Create a hold on the selected slot
      const response = await fetch("/api/holds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          eventTypeId: eventType.id,
          hostUserId: hostProfile.id,
          startAt: slot.start,
          endAt: slot.end,
          guestEmail: rescheduleContext?.guestEmail ?? "pending@placeholder.com",
          idempotencyKey,
          turnstileToken: holdTurnstileToken ?? undefined,
          slotToken: slot.slotToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          const conflictMessage =
            "This slot has been taken by another guest. Please select a different time.";
          setSelectedSlot(null);
          setFlowState({ step: "select-slot" });
          holdIdempotencyKeysRef.current.delete(holdKey);
          if (selectedDate) {
            await fetchSlots(selectedDate, timezone, { force: true });
          }
          setError(conflictMessage);
          return;
        }
        setError(data.error || "Failed to hold slot. Please try again.");
        setSelectedSlot(null);
        setFlowState({ step: "select-slot" });
        holdIdempotencyKeysRef.current.delete(holdKey);
        return;
      }

      // Hold created successfully — attach the token to the already visible form.
      holdIdempotencyKeysRef.current.delete(holdKey);
      setFlowState({
        step: "booking-form",
        hold: {
          holdToken: data.holdToken,
          expiresAt: data.expiresAt,
        },
        slot,
      });
    } catch {
      setError("Unable to hold slot. Please try again.");
      setSelectedSlot(null);
      setFlowState({ step: "select-slot" });
    } finally {
      if (turnstileRequired) {
        setHoldTurnstileToken(null);
        setHoldTurnstileResetKey((key) => key + 1);
      }
      setHoldLoading(false);
    }
  }

  function handleBookingConfirmed(result: BookingResult) {
    setFlowState({ step: "confirmed", booking: result });
  }

  function handleHoldExpired() {
    setError(
      "Your hold has expired. Please select a new time slot."
    );
    setSelectedSlot(null);
    setFlowState({ step: "select-slot" });
    // Refresh slots to show updated availability
    if (selectedDate) {
      fetchSlots(selectedDate, timezone, { force: true });
    }
  }

  function handleSlotTaken() {
    setError(
      "This slot has been booked by someone else. Please select a different time."
    );
    setSelectedSlot(null);
    setFlowState({ step: "select-slot" });
    // Refresh slots to show updated availability
    if (selectedDate) {
      fetchSlots(selectedDate, timezone, { force: true });
    }
  }

  function formatSlotTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || undefined,
    });
  }

  const timezoneOptions = timezoneOptionsWithCurrent(timezone);

  // If booking is confirmed, show the confirmation page
  if (flowState.step === "confirmed") {
    return (
      <div className="max-w-4xl mx-auto">
        <BookingConfirmation
          bookingId={flowState.booking.bookingId}
          cancellationToken={flowState.booking.cancellationToken}
          rescheduleToken={flowState.booking.rescheduleToken}
          startAt={flowState.booking.startAt}
          endAt={flowState.booking.endAt}
          guestName={flowState.booking.guestName}
          eventTitle={flowState.booking.eventTitle}
          hostName={hostProfile.name}
          timezone={timezone}
          locationType={eventType.location_type}
          locationValue={eventType.location_value}
          conferenceProvider={eventType.video_provider}
          conferenceStatus={flowState.booking.conferenceStatus}
          conferenceUrl={flowState.booking.conferenceUrl}
          variant={rescheduleContext ? "reschedule" : "booking"}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Event type header */}
      <BookingPageEventHeader
        eventType={eventType}
        hostProfile={hostProfile}
      />

      {/* Timezone selector */}
      <div className="mb-6 flex flex-col items-stretch gap-2 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-center">
        <label
          htmlFor="timezone-select"
          className="text-sm font-medium text-foreground"
        >
          Timezone
        </label>
        <Select value={timezone} onValueChange={handleTimezoneChange}>
          <SelectTrigger className="w-full sm:w-[280px]" id="timezone-select">
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
      </div>

      {/* Date picker and slots */}
      <div
        className={cn(
          "grid grid-cols-1 gap-6",
          layout === "public" && "md:grid-cols-2"
        )}
      >
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select a date</CardTitle>
            <CardDescription>
              Choose a date to see available times
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) =>
                date < new Date(new Date().setHours(0, 0, 0, 0))
              }
            />
          </CardContent>
        </Card>

        {/* Available slots */}
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
            {!selectedDate && (
              <EmptyState
                icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
                heading="Choose a date"
                description="Pick an available date from the calendar to see times in your timezone."
                className="border-0 bg-muted/30 py-10"
              />
            )}

            {selectedDate && loading && (
              <div className="flex items-center justify-center rounded-lg bg-muted/30 py-10" role="status">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading available slots...
                </span>
              </div>
            )}

            {selectedDate && !loading && error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-8 text-center" role="alert">
                <AlertCircle className="mx-auto h-6 w-6 text-destructive" aria-hidden="true" />
                <p className="mt-2 text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setError(null);
                    fetchSlots(selectedDate, timezone, { force: true });
                  }}
                >
                  Try Again
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
                  onTokenChange={setHoldTurnstileToken}
                />
                <div className="grid max-h-[400px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {slots.map((slot) => (
                    <TimeSlotButton
                      key={slot.start}
                      time={formatSlotTime(slot.start)}
                      selected={selectedSlot?.start === slot.start}
                      onClick={() => handleSlotSelect(slot)}
                      disabled={
                        holdLoading ||
                        (turnstileRequired && !holdTurnstileToken)
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

      {showBookingAgent && (
        <BookingAgentPanel
          mode={rescheduleContext ? "reschedule" : "booking"}
          eventTypeId={eventType.id}
          hostUserId={hostProfile.id}
          timezone={timezone}
          selectedDate={selectedDateString}
          selectedSlot={selectedSlot}
          rescheduleToken={rescheduleContext?.token}
          holdDisabled={
            holdLoading || (turnstileRequired && !holdTurnstileToken)
          }
          holdDisabledReason={
            turnstileRequired && !holdTurnstileToken
              ? "Complete the verification challenge before holding a time."
              : "Please wait while this time is being held."
          }
          onSelectSlot={handleSlotSelect}
          onDraftChange={(draft) =>
            setAgentDraft((current) => mergeBookingAgentDrafts(current, draft))
          }
        />
      )}

      {/* Booking form (shown after hold is created) */}
      {flowState.step === "booking-form" && (
        <BookingForm
          holdToken={flowState.hold?.holdToken}
          expiresAt={flowState.hold?.expiresAt}
          holdPending={!flowState.hold}
          selectedSlot={flowState.slot}
          eventTitle={eventType.title}
          hostName={hostProfile.name}
          timezone={timezone}
          inviteeQuestions={eventType.invitee_questions}
          rescheduleToken={rescheduleContext?.token}
          initialGuest={
            rescheduleContext
              ? {
                  name: rescheduleContext.guestName,
                  email: rescheduleContext.guestEmail,
                  timezone: rescheduleContext.guestTimezone,
                }
              : undefined
          }
          initialDraft={agentDraft}
          onConfirmed={handleBookingConfirmed}
          onHoldExpired={handleHoldExpired}
          onSlotTaken={handleSlotTaken}
        />
      )}
    </div>
  );
}

function hasSlotsForDate(slotsByDate: SlotsByDate, date: string): boolean {
  return Object.prototype.hasOwnProperty.call(slotsByDate, date);
}

export function mergeBookingAgentDrafts(
  current: BookingAgentDraft,
  incoming: BookingAgentDraft
): BookingAgentDraft {
  const merged = { ...current, ...incoming };

  if (current.answers || incoming.answers) {
    merged.answers = {
      ...(current.answers ?? {}),
      ...(incoming.answers ?? {}),
    };
  }

  return merged;
}

function holdIdempotencyKeyForSlot(slot: TimeSlot): string {
  return `${slot.start}:${slot.end}:${slot.slotToken ?? ""}`;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
