"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { addDays, format } from "date-fns";
import { isTurnstileEnabled } from "@/components/booking/turnstile-widget";
import { SlotPickerView } from "@/components/booking/slot-picker-view";
import {
  browserTimezoneOrDefault,
  DEFAULT_TIMEZONE,
} from "@/lib/utils/timezone";
import { createClientIdempotencyKey } from "@/lib/idempotency/client-idempotency";
import type { TimeSlot } from "@/lib/availability/types";
import type { BookingAgentDraft } from "@/lib/booking-agent/types";
import {
  hasSlotsForDate,
  holdIdempotencyKeyForSlot,
  mergeBookingAgentDrafts,
  SLOT_PREFETCH_DAYS,
} from "@/components/booking/slot-picker-helpers";
import type {
  BookingFlowState,
  BookingResult,
  FetchSlotsOptions,
  HoldResponseBody,
  SlotPickerEventType,
  SlotPickerHostProfile,
  SlotPickerRescheduleContext,
  SlotsByDate,
} from "@/components/booking/slot-picker-types";

export type {
  SlotPickerEventType,
  SlotPickerHostProfile,
} from "@/components/booking/slot-picker-types";
export { mergeBookingAgentDrafts } from "@/components/booking/slot-picker-helpers";

// The real guest email is collected after the provisional hold is created.
const PROVISIONAL_HOLD_GUEST_EMAIL = "pending@openslot.invalid";

interface SlotPickerProps {
  eventType: SlotPickerEventType;
  hostProfile: SlotPickerHostProfile;
  layout?: "public" | "embedded";
  bookingAgentEnabled?: boolean;
  rescheduleContext?: SlotPickerRescheduleContext;
}

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
  const slotsByDateRef = useRef<SlotsByDate>({});
  const holdIdempotencyKeysRef = useRef<Map<string, string>>(new Map());
  const slotWindowRequestRef = useRef(0);
  const holdRequestRef = useRef(0);
  const slotPickerIdentityRef = useRef(`${hostProfile.id}:${eventType.id}`);
  const [flowState, setFlowState] = useState<BookingFlowState>({
    step: "select-slot",
  });
  const turnstileRequired = isTurnstileEnabled();

  useEffect(() => {
    setTimezone(browserTimezoneOrDefault());
    setTimezoneReady(true);
  }, []);

  const fetchSlotWindow = useCallback(
    async (anchorDate: Date, tz: string, applyDate?: Date) => {
      const requestId = slotWindowRequestRef.current + 1;
      slotWindowRequestRef.current = requestId;
      const isLatestRequest = () => slotWindowRequestRef.current === requestId;
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

        if (!isLatestRequest()) return;

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          if (!isLatestRequest()) return;
          if (shouldApply) {
            setError(
              data?.error || "Failed to fetch available slots. Please try again."
            );
          }
          return;
        }

        const data = await response.json();
        if (!isLatestRequest()) return;
        const nextSlotsByDate = (data.slotsByDate ?? {}) as SlotsByDate;

        slotsByDateRef.current = {
          ...slotsByDateRef.current,
          ...nextSlotsByDate,
        };

        if (applyDateString) {
          setSlots(nextSlotsByDate[applyDateString] ?? []);
        }
      } catch {
        if (shouldApply && isLatestRequest()) {
          setError(
            "Unable to load available slots. The service may be temporarily unavailable."
          );
        }
      } finally {
        if (shouldApply && isLatestRequest()) {
          setLoading(false);
        }
      }
    },
    [hostProfile.id, eventType.id]
  );

  const fetchSlots = useCallback(
    async (date: Date, tz: string, options: FetchSlotsOptions = {}) => {
      const dateStr = format(date, "yyyy-MM-dd");

      const cachedSlotsByDate = slotsByDateRef.current;

      if (!options.force && hasSlotsForDate(cachedSlotsByDate, dateStr)) {
        setError(null);
        setSlots(cachedSlotsByDate[dateStr] ?? []);
        setSelectedSlot(null);
        setLoading(false);
        return;
      }

      await fetchSlotWindow(date, tz, date);
    },
    [fetchSlotWindow]
  );

  useEffect(() => {
    const currentIdentity = `${hostProfile.id}:${eventType.id}`;
    const previousIdentity = slotPickerIdentityRef.current;

    if (previousIdentity === currentIdentity) return;

    slotPickerIdentityRef.current = currentIdentity;
    slotWindowRequestRef.current += 1;
    holdRequestRef.current += 1;
    slotsByDateRef.current = {};
    setSlots([]);
    setSelectedSlot(null);
    setAgentDraft({});
    holdIdempotencyKeysRef.current.clear();
    setError(null);
    setLoading(false);
    setHoldLoading(false);
    setFlowState((current) =>
      current.step === "confirmed" ? current : { step: "select-slot" }
    );
  }, [eventType.id, hostProfile.id]);

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
    slotWindowRequestRef.current += 1;
    holdRequestRef.current += 1;
    setSelectedDate(date);
    setSelectedSlot(null);
    setHoldLoading(false);
    if (!date) {
      setLoading(false);
      setError(null);
      setSlots([]);
    }
    // Reset flow state when changing date
    if (flowState.step !== "confirmed") {
      setFlowState({ step: "select-slot" });
    }
  }

  function handleTimezoneChange(tz: string) {
    slotWindowRequestRef.current += 1;
    holdRequestRef.current += 1;
    setTimezone(tz);
    slotsByDateRef.current = {};
    setSlots([]);
    setSelectedSlot(null);
    setHoldLoading(false);
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

    const holdRequestId = holdRequestRef.current + 1;
    holdRequestRef.current = holdRequestId;
    const isLatestHoldRequest = () => holdRequestRef.current === holdRequestId;
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
      holdIdempotencyKeysRef.current.get(holdKey) ??
      createClientIdempotencyKey();
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
          guestEmail:
            rescheduleContext?.guestEmail ?? PROVISIONAL_HOLD_GUEST_EMAIL,
          idempotencyKey,
          turnstileToken: holdTurnstileToken ?? undefined,
          slotToken: slot.slotToken,
        }),
      });

      if (!isLatestHoldRequest()) return;
      const data = (await response
        .json()
        .catch(() => ({}))) as HoldResponseBody;
      if (!isLatestHoldRequest()) return;

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
          if (!isLatestHoldRequest()) return;
          setError(conflictMessage);
          return;
        }
        setError(data.error || "Failed to hold slot. Please try again.");
        setSelectedSlot(null);
        setFlowState({ step: "select-slot" });
        holdIdempotencyKeysRef.current.delete(holdKey);
        return;
      }

      if (!data.holdToken || !data.expiresAt) {
        setError("Failed to hold slot. Please try again.");
        setSelectedSlot(null);
        setFlowState({ step: "select-slot" });
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
      if (!isLatestHoldRequest()) return;
      setError("Unable to hold slot. Please try again.");
      setSelectedSlot(null);
      setFlowState({ step: "select-slot" });
    } finally {
      if (!isLatestHoldRequest()) return;
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

  function handleRetrySlots() {
    setError(null);
    if (selectedDate) {
      fetchSlots(selectedDate, timezone, { force: true });
    }
  }

  return (
    <SlotPickerView
      agentDraft={agentDraft}
      bookingAgentEnabled={bookingAgentEnabled}
      eventType={eventType}
      flowState={flowState}
      holdLoading={holdLoading}
      holdTurnstileResetKey={holdTurnstileResetKey}
      holdTurnstileToken={holdTurnstileToken}
      hostProfile={hostProfile}
      layout={layout}
      loading={loading}
      rescheduleContext={rescheduleContext}
      selectedDate={selectedDate}
      selectedSlot={selectedSlot}
      slots={slots}
      timezone={timezone}
      turnstileRequired={turnstileRequired}
      error={error}
      onAgentDraftChange={(draft) =>
        setAgentDraft((current) => mergeBookingAgentDrafts(current, draft))
      }
      onBookingConfirmed={handleBookingConfirmed}
      onDateSelect={handleDateSelect}
      onHoldExpired={handleHoldExpired}
      onHoldTurnstileTokenChange={setHoldTurnstileToken}
      onRetrySlots={handleRetrySlots}
      onSlotSelect={handleSlotSelect}
      onSlotTaken={handleSlotTaken}
      onTimezoneChange={handleTimezoneChange}
    />
  );
}
