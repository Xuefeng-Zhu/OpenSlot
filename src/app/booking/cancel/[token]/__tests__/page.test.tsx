import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CancelBookingPage from "../page";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
  getCancellationDetails: vi.fn(),
  isValidCancellationToken: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/booking/cancellation-details", () => ({
  getCancellationDetails: mocks.getCancellationDetails,
  isValidCancellationToken: mocks.isValidCancellationToken,
}));

const token = "11111111-1111-4111-8111-111111111111";

const booking = {
  bookingId: "booking-1",
  cancellationToken: token,
  eventTitle: "Intro Call",
  hostName: "Sarah Chen",
  guestName: "Jane Doe",
  startAt: "2026-05-15T14:00:00Z",
  endAt: "2026-05-15T14:30:00Z",
  guestTimezone: "America/New_York",
};

async function renderPage(tokenParam = token) {
  const ui = await CancelBookingPage({
    params: Promise.resolve({ token: tokenParam }),
  });

  render(ui);
}

describe("CancelBookingPage", () => {
  beforeEach(() => {
    mocks.createAdminClient.mockClear();
    mocks.getCancellationDetails.mockReset();
    mocks.isValidCancellationToken.mockReset();
    mocks.isValidCancellationToken.mockReturnValue(true);
  });

  it("renders the live cancellation form for an active booking token", async () => {
    mocks.getCancellationDetails.mockResolvedValue({
      status: "active",
      booking,
    });

    await renderPage();

    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(mocks.getCancellationDetails).toHaveBeenCalledWith(
      token,
      expect.any(Object)
    );
    expect(
      screen.getByRole("heading", { name: "Cancel Booking" })
    ).toBeDefined();
    expect(screen.getByText("Intro Call")).toBeDefined();
    expect(screen.getByText("Sarah Chen")).toBeDefined();
    expect(screen.getByText("Jane Doe")).toBeDefined();
  });

  it("renders an invalid-link state without creating an admin client for malformed tokens", async () => {
    mocks.isValidCancellationToken.mockReturnValue(false);

    await renderPage("not-a-token");

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.getCancellationDetails).not.toHaveBeenCalled();
    expect(screen.getByText("Invalid Cancellation Link")).toBeDefined();
  });

  it("renders an already-cancelled state for cancelled bookings", async () => {
    mocks.getCancellationDetails.mockResolvedValue({
      status: "already-cancelled",
      booking: {
        ...booking,
        cancelledAt: "2026-05-14T16:45:00Z",
      },
    });

    await renderPage();

    expect(screen.getByText("Already Cancelled")).toBeDefined();
    expect(
      screen.getByText("This booking has already been cancelled.")
    ).toBeDefined();
    expect(screen.getByText("Intro Call")).toBeDefined();
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
  });
});
