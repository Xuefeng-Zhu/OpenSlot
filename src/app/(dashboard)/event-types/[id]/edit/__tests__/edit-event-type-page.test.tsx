import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EventTypeEditor,
  type EditableEventType,
} from "../../../event-type-editor";
import { DashboardNavigationGuardProvider } from "@/components/dashboard/navigation-guard-provider";

const push = vi.fn();
const refresh = vi.fn();
const schedules = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Default schedule",
    is_default: true,
  },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
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
    refresh.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("disables unchanged saves and guards Cancel until changes are discarded", () => {
    render(
      <DashboardNavigationGuardProvider>
        <EventTypeEditor
          mode="edit"
          hostProfile={hostProfile}
          schedules={schedules}
          initialEventType={strategySession}
        />
      </DashboardNavigationGuardProvider>
    );

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Strategy workshop" },
    });
    expect(saveButton).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Discard unsaved changes?" })
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Strategy workshop"
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Discard and continue" })
    );

    expect(push).toHaveBeenCalledWith("/event-types");
  });

  it("clears edit dirty state when values return to their saved semantics", () => {
    render(
      <DashboardNavigationGuardProvider>
        <EventTypeEditor
          mode="edit"
          hostProfile={hostProfile}
          schedules={schedules}
          initialEventType={strategySession}
        />
      </DashboardNavigationGuardProvider>
    );

    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Strategy workshop" },
    });
    expect(saveButton).toHaveProperty("disabled", false);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  Strategy session  " },
    });
    expect(saveButton).toHaveProperty("disabled", true);
  });

  it("clears edit dirty state after a successful save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    render(
      <DashboardNavigationGuardProvider>
        <EventTypeEditor
          mode="edit"
          hostProfile={hostProfile}
          schedules={schedules}
          initialEventType={strategySession}
        />
      </DashboardNavigationGuardProvider>
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Strategy workshop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/event-types");
      expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
        "disabled",
        true
      );
    });

    push.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(push).toHaveBeenCalledWith("/event-types");
    expect(screen.queryByText("Discard unsaved changes?")).toBeNull();
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
                watch: {
                  status: "active",
                  expiresAt: "2026-05-15T00:00:00.000Z",
                  lastSyncAt: "2026-05-08T01:00:00.000Z",
                  lastError: null,
                },
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

  it("clears stale manual location details when the location type changes", () => {
    render(
      <EventTypeEditor
        mode="edit"
        hostProfile={hostProfile}
        schedules={schedules}
        initialEventType={strategySession}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Location/ }));

    const locationDetails = screen.getByLabelText(
      "Location details"
    ) as HTMLInputElement;
    expect(locationDetails.value).toBe("https://zoom.us/j/987654");

    fireEvent.change(screen.getByLabelText("Location type"), {
      target: { value: "phone" },
    });

    expect(
      (screen.getByLabelText("Location details") as HTMLInputElement).value
    ).toBe("");
  });
});
