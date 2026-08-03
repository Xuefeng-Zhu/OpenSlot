import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { SlotPickerView } from "../slot-picker-view";

expect.extend(toHaveNoViolations);

type SlotPickerViewProps = ComponentProps<typeof SlotPickerView>;

const eventType: SlotPickerViewProps["eventType"] = {
  id: "event-type-1",
  title: "Discovery Call",
  slug: "discovery-call",
  description: "A short intro call.",
  duration_minutes: 30,
  location_type: "online",
  location_value: null,
  video_provider: null,
  invitee_questions: [],
  user_id: "host-1",
};

const hostProfile: SlotPickerViewProps["hostProfile"] = {
  id: "host-1",
  name: "Sarah Chen",
  username: "sarah",
  avatar_url: null,
};

function confirmedViewProps(
  overrides: Partial<SlotPickerViewProps> = {}
): SlotPickerViewProps {
  return {
    agentDraft: {},
    bookingAgentEnabled: false,
    eventType,
    flowState: {
      step: "confirmed",
      booking: {
        bookingId: "booking-1",
        cancellationToken: "cancel-token",
        rescheduleToken: "reschedule-token",
        startAt: "2026-06-01T15:00:00.000Z",
        endAt: "2026-06-01T15:30:00.000Z",
        guestName: "Jane Doe",
        eventTitle: "Discovery Call",
      },
    },
    holdLoading: false,
    holdTurnstileResetKey: 0,
    holdTurnstileToken: null,
    hostProfile,
    layout: "public",
    eventHeadingLevel: 1,
    loading: false,
    selectedDate: undefined,
    selectedSlot: null,
    slots: [],
    timezone: "America/New_York",
    turnstileRequired: false,
    error: null,
    onAgentDraftChange: vi.fn(),
    onBookingConfirmed: vi.fn(),
    onDateSelect: vi.fn(),
    onHoldExpired: vi.fn(),
    onHoldTurnstileTokenChange: vi.fn(),
    onRetrySlots: vi.fn(),
    onSlotSelect: vi.fn(),
    onSlotTaken: vi.fn(),
    onTimezoneChange: vi.fn(),
    ...overrides,
  };
}

describe("SlotPickerView confirmed headings", () => {
  it("retains exactly one h1 after a public booking is confirmed", async () => {
    const { container } = render(<SlotPickerView {...confirmedViewProps()} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Booking confirmed" })
    ).toBeDefined();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps a reschedule confirmation below the reschedule page h1", async () => {
    const { container } = render(
      <>
        <h1>Reschedule booking</h1>
        <SlotPickerView
          {...confirmedViewProps({
            eventHeadingLevel: 2,
            rescheduleContext: {
              token: "reschedule-token",
              guestName: "Jane Doe",
              guestEmail: "jane@example.com",
              guestTimezone: "America/New_York",
              currentStartAt: "2026-05-01T15:00:00.000Z",
              currentEndAt: "2026-05-01T15:30:00.000Z",
            },
          })}
        />
      </>
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 2, name: "Booking rescheduled" })
    ).toBeDefined();
    expect(await axe(container)).toHaveNoViolations();
  });
});
