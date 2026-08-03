import {
  defaultDashboardDisplayPreferences,
  formatDashboardDuration,
  formatDashboardRelativeDate,
  formatDashboardTime,
  type DashboardDisplayPreferences,
} from "@/lib/dashboard/display-preferences";

export function formatDashboardBookingDate(
  startAt: string,
  now = new Date(),
  preferences: DashboardDisplayPreferences = defaultDashboardDisplayPreferences
): string {
  return formatDashboardRelativeDate(startAt, preferences, now);
}

export function formatDashboardBookingTime(
  startAt: string,
  preferences: DashboardDisplayPreferences = defaultDashboardDisplayPreferences
): string {
  return formatDashboardTime(startAt, preferences);
}

export function formatDashboardBookingDuration(
  startAt: string,
  endAt: string
): string {
  return formatDashboardDuration(startAt, endAt);
}
