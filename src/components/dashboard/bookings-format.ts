import type { BookingCategory } from "@/lib/booking-utils";
import {
  defaultDashboardDisplayPreferences,
  formatDashboardDate,
  formatDashboardTime,
  type DashboardDisplayPreferences,
} from "@/lib/dashboard/display-preferences";

export function getBookingStatusLabel(category: BookingCategory): string {
  if (category === "upcoming") return "Confirmed";
  if (category === "cancelled") return "Cancelled";
  return "Completed";
}

export function formatBookingDateTime(
  isoString: string,
  preferences: DashboardDisplayPreferences = defaultDashboardDisplayPreferences
): {
  date: string;
  time: string;
} {
  return {
    date: formatDashboardDate(isoString, preferences),
    time: formatDashboardTime(isoString, preferences),
  };
}
