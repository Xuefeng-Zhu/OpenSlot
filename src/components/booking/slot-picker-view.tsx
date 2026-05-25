"use client";

import { format } from "date-fns";
import type { TimeSlot } from "@/lib/availability/types";
import type { BookingAgentDraft } from "@/lib/booking-agent/types";
import { BookingAgentPanel } from "@/components/booking/booking-agent-panel";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { BookingForm } from "@/components/booking/booking-form";
import { BookingPageEventHeader } from "@/components/booking/booking-page-event-header";
import { SlotPickerTimezoneControl } from "@/components/booking/slot-picker-timezone-control";
import { SlotSelectionGrid } from "@/components/booking/slot-selection-grid";
import { formatBookingTime } from "@/lib/booking/date-time-format";
import type {
  BookingFlowState,
  BookingResult,
  SlotPickerEventType,
  SlotPickerHostProfile,
  SlotPickerRescheduleContext,
} from "@/components/booking/slot-picker-types";

interface SlotPickerViewProps {
  agentDraft: BookingAgentDraft;
  bookingAgentEnabled: boolean;
  eventType: SlotPickerEventType;
  flowState: BookingFlowState;
  holdLoading: boolean;
  holdTurnstileResetKey: number;
  holdTurnstileToken: string | null;
  hostProfile: SlotPickerHostProfile;
  layout: "public" | "embedded";
  loading: boolean;
  rescheduleContext?: SlotPickerRescheduleContext;
  selectedDate: Date | undefined;
  selectedSlot: TimeSlot | null;
  slots: TimeSlot[];
  timezone: string;
  turnstileRequired: boolean;
  error: string | null;
  onAgentDraftChange: (draft: BookingAgentDraft) => void;
  onBookingConfirmed: (result: BookingResult) => void;
  onDateSelect: (date: Date | undefined) => void;
  onHoldExpired: () => void;
  onHoldTurnstileTokenChange: (token: string | null) => void;
  onRetrySlots: () => void;
  onSlotSelect: (slot: TimeSlot) => void;
  onSlotTaken: () => void;
  onTimezoneChange: (timezone: string) => void;
}

export function SlotPickerView({
  agentDraft,
  bookingAgentEnabled,
  eventType,
  flowState,
  holdLoading,
  holdTurnstileResetKey,
  holdTurnstileToken,
  hostProfile,
  layout,
  loading,
  rescheduleContext,
  selectedDate,
  selectedSlot,
  slots,
  timezone,
  turnstileRequired,
  error,
  onAgentDraftChange,
  onBookingConfirmed,
  onDateSelect,
  onHoldExpired,
  onHoldTurnstileTokenChange,
  onRetrySlots,
  onSlotSelect,
  onSlotTaken,
  onTimezoneChange,
}: SlotPickerViewProps) {
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

  const selectedDateString = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : undefined;
  const showBookingAgent = bookingAgentEnabled && layout === "public";

  return (
    <div className="mx-auto max-w-4xl">
      <BookingPageEventHeader
        eventType={eventType}
        hostProfile={hostProfile}
      />

      <SlotPickerTimezoneControl
        timezone={timezone}
        onTimezoneChange={onTimezoneChange}
      />

      <SlotSelectionGrid
        layout={layout}
        selectedDate={selectedDate}
        loading={loading}
        error={error}
        slots={slots}
        selectedSlot={selectedSlot}
        holdLoading={holdLoading}
        holdTurnstileToken={holdTurnstileToken}
        holdTurnstileResetKey={holdTurnstileResetKey}
        turnstileRequired={turnstileRequired}
        onDateSelect={onDateSelect}
        onRetrySlots={onRetrySlots}
        onSlotSelect={onSlotSelect}
        onHoldTurnstileTokenChange={onHoldTurnstileTokenChange}
        formatSlotTime={(isoString) => formatBookingTime(isoString, timezone)}
      />

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
          onSelectSlot={onSlotSelect}
          onDraftChange={onAgentDraftChange}
        />
      )}

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
          onConfirmed={onBookingConfirmed}
          onHoldExpired={onHoldExpired}
          onSlotTaken={onSlotTaken}
        />
      )}
    </div>
  );
}
