import { describe, expect, it } from "vitest";
import {
  formatDashboardClockTime,
  formatDashboardDate,
  formatDashboardDateOnly,
  formatDashboardDuration,
  formatDashboardRelativeDate,
  formatDashboardTime,
  formatDashboardTimestamp,
  normalizeDashboardDisplayPreferences,
  type DashboardDisplayPreferences,
} from "@/lib/dashboard/display-preferences";

const preferences: DashboardDisplayPreferences = {
  timezone: "America/Los_Angeles",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
};

describe("dashboard display preferences", () => {
  it("normalizes invalid stored values to deterministic defaults", () => {
    expect(
      normalizeDashboardDisplayPreferences({
        timezone: "Invalid/Zone",
        dateFormat: "long",
        timeFormat: "military",
      })
    ).toEqual({
      timezone: "UTC",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
    });
  });

  it.each([
    ["MM/DD/YYYY", "06/14/2026"],
    ["DD/MM/YYYY", "14/06/2026"],
    ["YYYY-MM-DD", "2026-06-14"],
  ] as const)("renders %s in the host timezone", (dateFormat, expected) => {
    expect(
      formatDashboardDate("2026-06-15T00:30:00.000Z", {
        ...preferences,
        dateFormat,
      })
    ).toBe(expected);
  });

  it("honors 12- and 24-hour time settings", () => {
    const instant = "2026-06-15T02:05:00.000Z";

    expect(formatDashboardTime(instant, preferences)).toBe("7:05 PM");
    expect(
      formatDashboardTime(instant, { ...preferences, timeFormat: "24h" })
    ).toBe("19:05");
  });

  it("formats date-only and wall-clock values without timezone shifting", () => {
    expect(
      formatDashboardDateOnly("2026-01-02", {
        ...preferences,
        dateFormat: "DD/MM/YYYY",
      })
    ).toBe("02/01/2026");
    expect(formatDashboardClockTime("00:05", preferences)).toBe("12:05 AM");
    expect(
      formatDashboardClockTime("00:05", {
        ...preferences,
        timeFormat: "24h",
      })
    ).toBe("00:05");
  });

  it("calculates Today and Tomorrow in the host timezone", () => {
    const tokyoPreferences: DashboardDisplayPreferences = {
      timezone: "Asia/Tokyo",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
    };
    const now = "2026-06-15T23:30:00.000Z";

    expect(
      formatDashboardRelativeDate(
        "2026-06-16T02:00:00.000Z",
        tokyoPreferences,
        now
      )
    ).toBe("Today");
    expect(
      formatDashboardRelativeDate(
        "2026-06-16T16:00:00.000Z",
        tokyoPreferences,
        now
      )
    ).toBe("Tomorrow");
  });

  it("formats the Los Angeles spring-forward boundary without inventing 2 AM", () => {
    expect(
      formatDashboardTime("2026-03-08T09:30:00.000Z", preferences)
    ).toBe("1:30 AM");
    expect(
      formatDashboardTime("2026-03-08T10:30:00.000Z", preferences)
    ).toBe("3:30 AM");
    expect(
      formatDashboardRelativeDate(
        "2026-03-08T10:30:00.000Z",
        preferences,
        "2026-03-08T07:30:00.000Z"
      )
    ).toBe("Tomorrow");
  });

  it("uses an em dash for invalid timestamps and impossible date-only values", () => {
    expect(formatDashboardDate("not-a-date", preferences)).toBe("—");
    expect(formatDashboardTime("not-a-date", preferences)).toBe("—");
    expect(formatDashboardTimestamp("not-a-date", preferences)).toBe("—");
    expect(formatDashboardDateOnly("2026-02-30", preferences)).toBe("—");
    expect(formatDashboardClockTime("25:00", preferences)).toBe("—");
    expect(formatDashboardDuration("bad", "also-bad")).toBe("—");
  });
});
