import { beforeEach, describe, expect, it, vi } from "vitest";

import RescheduleBookingPage from "../page";

const expectedBookingSelect =
  "event_type_id, host_user_id, guest_name, guest_email, guest_timezone, start_at, end_at";

const mocks = vi.hoisted(() => ({
  createAdminBackendClient: vi.fn(),
  bookingSelect: vi.fn(),
}));

vi.mock("@/lib/backend/server", () => ({
  createAdminBackendClient: mocks.createAdminBackendClient,
}));

vi.mock("@/lib/backend/booking-agent-gateway", () => ({
  isBookingAgentConfigured: vi.fn(() => false),
}));

vi.mock("@/components/booking/slot-picker", () => ({
  SlotPicker: () => <div data-testid="slot-picker" />,
}));

function createQueryBuilder(table: string) {
  const builder = {
    select: vi.fn((columns: string) => {
      if (table === "bookings") {
        mocks.bookingSelect(columns);
      }

      return builder;
    }),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => {
      if (table === "bookings") {
        return {
          data: {
            event_type_id: "event-type-1",
            host_user_id: "profile-1",
            guest_name: "Jane Doe",
            guest_email: "jane@example.com",
            guest_timezone: "America/New_York",
            start_at: "2026-06-01T15:00:00.000Z",
            end_at: "2026-06-01T15:30:00.000Z",
          },
        };
      }

      if (table === "event_types") {
        return {
          data: {
            id: "event-type-1",
            title: "Intro Call",
            slug: "intro-call",
            description: null,
            duration_minutes: 30,
            location_type: "online",
            location_value: null,
            video_provider: null,
            invitee_questions: [],
            user_id: "profile-1",
          },
        };
      }

      return {
        data: {
          id: "profile-1",
          name: "Sarah Chen",
          username: "sarah",
          avatar_url: null,
        },
      };
    }),
  };

  return builder;
}

describe("RescheduleBookingPage", () => {
  beforeEach(() => {
    mocks.bookingSelect.mockReset();
    mocks.createAdminBackendClient.mockReset();
    mocks.createAdminBackendClient.mockReturnValue({
      from: vi.fn((table: string) => createQueryBuilder(table)),
    });
  });

  it("loads only the booking fields needed for the reschedule page", async () => {
    await RescheduleBookingPage({
      params: Promise.resolve({ token: "reschedule-token" }),
    });

    expect(mocks.bookingSelect).toHaveBeenCalledWith(expectedBookingSelect);
  });
});
