import { describe, expect, it } from "vitest";
import {
  formatDashboardBookingDate,
  formatDashboardBookingDuration,
  formatDashboardBookingTime,
} from "../dashboard-format";

describe("dashboard booking formatters", () => {
  it("uses relative labels for today and tomorrow", () => {
    const now = new Date(2026, 5, 15, 8, 0);
    const today = new Date(2026, 5, 15, 14, 30).toISOString();
    const tomorrow = new Date(2026, 5, 16, 9, 0).toISOString();

    expect(formatDashboardBookingDate(today, now)).toBe("Today");
    expect(formatDashboardBookingDate(tomorrow, now)).toBe("Tomorrow");
  });

  it("formats later booking dates for the dashboard list", () => {
    const now = new Date(2026, 5, 15, 8, 0);
    const later = new Date(2026, 5, 18, 9, 0).toISOString();

    expect(formatDashboardBookingDate(later, now)).toBe("Thu, Jun 18");
  });

  it("formats booking times and durations", () => {
    const start = new Date(2026, 5, 15, 14, 5).toISOString();
    const end = new Date(2026, 5, 15, 14, 50).toISOString();

    expect(formatDashboardBookingTime(start)).toBe("2:05 PM");
    expect(formatDashboardBookingDuration(start, end)).toBe("45 min");
  });
});
