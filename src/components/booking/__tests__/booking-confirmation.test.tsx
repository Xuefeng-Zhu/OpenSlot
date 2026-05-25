import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BookingConfirmation } from "../booking-confirmation";

describe("BookingConfirmation", () => {
  it("opens generated meeting links in a new tab", () => {
    render(
      <BookingConfirmation
        bookingId="booking-1"
        cancellationToken="cancel-token"
        startAt="2026-06-01T15:00:00.000Z"
        endAt="2026-06-01T15:30:00.000Z"
        guestName="Jane Doe"
        eventTitle="Intro Call"
        hostName="Sarah Chen"
        timezone="America/New_York"
        conferenceProvider="google_meet"
        conferenceStatus="ready"
        conferenceUrl="https://meet.google.com/abc-defg-hij"
      />
    );

    const link = screen.getByRole("link", { name: "Open meeting" });

    expect(link.getAttribute("href")).toBe("https://meet.google.com/abc-defg-hij");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
