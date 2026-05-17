import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EventTypeEditor,
  type EditableEventType,
} from "../../../event-type-editor";

const push = vi.fn();
const schedules = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Default schedule",
    is_default: true,
  },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const strategySession: EditableEventType = {
  id: "event-type-2",
  schedule_id: "33333333-3333-4333-8333-333333333333",
  title: "Strategy session",
  slug: "strategy-session",
  description: "A deeper session to discuss goals and next steps.",
  duration_minutes: 60,
  buffer_before_minutes: 5,
  buffer_after_minutes: 5,
  min_notice_minutes: 60,
  max_booking_days_ahead: 60,
  location_type: "online",
  location_value: "https://zoom.us/j/987654",
  invitee_questions: [],
  is_active: true,
  reminder_enabled: true,
  reminder_minutes_before: 60,
  reminder_guest_enabled: true,
  reminder_host_enabled: false,
};

const hostProfile = {
  id: "host-1",
  name: "Sarah Chen",
  username: "sarah",
  avatar_url: null,
};

describe("EditEventTypePage editor", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("loads the event type selected from the event types list", () => {
    render(
      <EventTypeEditor
        mode="edit"
        hostProfile={hostProfile}
        schedules={schedules}
        initialEventType={strategySession}
      />
    );

    expect(
      screen.getByText('Update the settings for "Strategy session".')
    ).toBeDefined();
    expect(screen.getByText("Sarah Chen")).toBeDefined();
    expect(screen.getAllByText("60 min").length).toBeGreaterThan(0);
    expect(screen.getByText("Select a date")).toBeDefined();
    expect(screen.getByText("Available times")).toBeDefined();
    expect(screen.queryByText("Visibility")).toBeNull();
    expect(screen.queryByText("Buffer before")).toBeNull();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Strategy session"
    );
    expect((screen.getByLabelText("URL Slug") as HTMLInputElement).value).toBe(
      "strategy-session"
    );
    expect(
      (screen.getByLabelText("Description") as HTMLTextAreaElement).value
    ).toBe("A deeper session to discuss goals and next steps.");

    fireEvent.click(screen.getByRole("button", { name: "Reminders" }));

    expect(
      screen.getByRole("switch", { name: "Enable pre-meeting reminders" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      (screen.getByLabelText("Send before start (minutes)") as HTMLInputElement)
        .value
    ).toBe("60");
    expect(
      screen.getByRole("switch", { name: "Email guest reminders" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      screen.getByRole("switch", { name: "Email host reminders" })
        .getAttribute("aria-checked")
    ).toBe("false");
  });

  it("clears field-level validation errors when corrected", () => {
    render(
      <EventTypeEditor
        mode="edit"
        hostProfile={hostProfile}
        schedules={schedules}
        initialEventType={strategySession}
      />
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("URL Slug"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Title is required")).toBeDefined();
    expect(screen.getByText("URL slug is required")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Strategy workshop" },
    });

    expect(screen.queryByText("Title is required")).toBeNull();
    expect(screen.getByText("URL slug is required")).toBeDefined();

    fireEvent.change(screen.getByLabelText("URL Slug"), {
      target: { value: "strategy-workshop" },
    });

    expect(screen.queryByText("URL slug is required")).toBeNull();
  });

  it("shows video provider readiness from calendar connections", () => {
    render(
      <EventTypeEditor
        mode="edit"
        hostProfile={hostProfile}
        schedules={schedules}
        initialEventType={strategySession}
        calendarConnections={[
          {
            id: "connection-1",
            provider: "google",
            accountEmail: "sarah@example.com",
            status: "active",
            connectedAt: "2026-05-08T00:00:00.000Z",
            lastSyncedAt: null,
            lastError: null,
            calendars: [
              {
                id: "calendar-1",
                externalCalendarId: "primary",
                summary: "Primary",
                timezone: "America/Los_Angeles",
                isPrimary: true,
                useForAvailability: true,
                useForWrites: true,
              },
            ],
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Location/ }));
    fireEvent.change(screen.getByLabelText("Location type"), {
      target: { value: "google_meet" },
    });

    expect(
      screen.getAllByText(
        "Google Meet is ready to generate links for new bookings."
      ).length
    ).toBeGreaterThan(0);
  });
});
