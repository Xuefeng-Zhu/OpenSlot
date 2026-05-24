import type { BookingCategory } from "@/lib/booking-utils";

export function getBookingStatusLabel(category: BookingCategory): string {
  if (category === "upcoming") return "Confirmed";
  if (category === "cancelled") return "Cancelled";
  return "Completed";
}

export function formatBookingDateTime(isoString: string): {
  date: string;
  time: string;
} {
  const d = new Date(isoString);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return { date, time };
}
