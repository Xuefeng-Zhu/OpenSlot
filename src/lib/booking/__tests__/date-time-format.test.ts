import { describe, expect, it } from "vitest";
import { formatBookingDate, formatBookingTime } from "../date-time-format";

describe("booking date/time formatting", () => {
  it("formats dates in the requested timezone", () => {
    expect(
      formatBookingDate("2026-06-16T04:30:00.000Z", "America/Los_Angeles")
    ).toBe("Monday, June 15, 2026");
  });

  it("formats times in the requested timezone", () => {
    expect(
      formatBookingTime("2026-06-16T16:30:00.000Z", "America/Los_Angeles")
    ).toMatch(/09:30|9:30/);
  });
});
