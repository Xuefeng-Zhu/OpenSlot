import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsClient } from "../settings-client";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      updateUser: vi.fn(),
    },
  }),
}));

const initialSettings = {
  name: "Test User",
  email: "test@example.com",
  defaultTimezone: "America/Los_Angeles",
  dateFormat: "MM/DD/YYYY" as const,
  timeFormat: "12h" as const,
  notifyNewBooking: true,
  notifyCancellation: true,
  notifyReminder: false,
};

describe("SettingsClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("clears a one-time webhook secret after deleting that endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          secretToken: "secret-token",
          endpoint: {
            id: "endpoint-1",
            url: "https://example.com/webhook",
            description: "QA endpoint",
            subscribedEvents: ["booking.confirmed"],
            isActive: true,
            createdAt: "2026-05-08T00:00:00.000Z",
            updatedAt: "2026-05-08T00:00:00.000Z",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <SettingsClient
        initialSettings={initialSettings}
        calendarConnections={[]}
        webhookEndpoints={[]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));
    fireEvent.change(screen.getByLabelText("Endpoint URL"), {
      target: { value: "https://example.com/webhook" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "QA endpoint" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add endpoint" }));

    expect(await screen.findByLabelText("Signing secret")).toBeDefined();
    expect(screen.getByText("https://example.com/webhook")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("https://example.com/webhook")).toBeNull();
    });

    expect(screen.queryByLabelText("Signing secret")).toBeNull();
    expect(screen.getByText("No webhook endpoints configured.")).toBeDefined();
  });
});
