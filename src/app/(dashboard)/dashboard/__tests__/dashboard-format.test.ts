import { describe, expect, it } from "vitest";
import {
  formatDashboardBookingDate,
  formatDashboardBookingDuration,
  formatDashboardBookingTime,
} from "../dashboard-format";
import type { DashboardDisplayPreferences } from "@/lib/dashboard/display-preferences";

const preferences: DashboardDisplayPreferences = {
  timezone: "America/Los_Angeles",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
};

describe("dashboard booking formatters", () => {
  it("uses relative labels for today and tomorrow", () => {
    const now = new Date("2026-06-15T15:00:00.000Z");
    const today = "2026-06-15T21:30:00.000Z";
    const tomorrow = "2026-06-16T16:00:00.000Z";

    expect(formatDashboardBookingDate(today, now, preferences)).toBe("Today");
    expect(formatDashboardBookingDate(tomorrow, now, preferences)).toBe(
      "Tomorrow"
    );
  });

  it("formats later booking dates for the dashboard list", () => {
    const now = new Date("2026-06-15T15:00:00.000Z");
    const later = "2026-06-18T16:00:00.000Z";

    expect(formatDashboardBookingDate(later, now, preferences)).toBe(
      "06/18/2026"
    );
  });

  it("formats booking times and durations", () => {
    const start = "2026-06-15T21:05:00.000Z";
    const end = "2026-06-15T21:50:00.000Z";

    expect(formatDashboardBookingTime(start, preferences)).toBe("2:05 PM");
    expect(formatDashboardBookingDuration(start, end)).toBe("45 min");
  });
});
