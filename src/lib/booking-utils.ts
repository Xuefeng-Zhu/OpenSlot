/**
 * Pure utility functions for booking categorization and filtering.
 * These are extracted for testability via property-based tests.
 */
import type { BookingAnswerSummary } from './validations/invitee-questions'

export interface Booking {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_timezone: string;
  notes: string;
  booking_answers?: BookingAnswerSummary[];
  start_at: string;
  end_at: string;
  status: string;
  cancellation_token: string;
  event_type_title: string;
  location_type?: string;
  location_value?: string;
  conference_provider?: string | null;
  conference_url?: string | null;
  conference_status?: string;
  conference_error?: string | null;
}

export type BookingCategory = "upcoming" | "past" | "cancelled";

export interface CategorizedBookings {
  upcoming: Booking[];
  past: Booking[];
  cancelled: Booking[];
}

/**
 * Categorizes a single booking into one of three categories:
 * - "upcoming": status is 'confirmed' AND start_at is in the future
 * - "past": status is 'confirmed' AND start_at is in the past
 * - "cancelled": status is 'cancelled'
 *
 * Bookings with other statuses are not categorized (excluded).
 *
 * Property 4: Booking categorization correctness
 * Validates: Requirements 4.2
 */
export function categorizeBooking(booking: Booking, now: Date = new Date()): BookingCategory | null {
  if (booking.status === "cancelled") {
    return "cancelled";
  }

  if (booking.status === "confirmed") {
    const startAt = new Date(booking.start_at);
    return startAt > now ? "upcoming" : "past";
  }

  return null;
}

/**
 * Categorizes an array of bookings into upcoming, past, and cancelled groups.
 *
 * Property 4: Booking categorization correctness
 * Validates: Requirements 4.2
 */
export function categorizeBookings(bookings: Booking[], now: Date = new Date()): CategorizedBookings {
  const result: CategorizedBookings = {
    upcoming: [],
    past: [],
    cancelled: [],
  };

  for (const booking of bookings) {
    const category = categorizeBooking(booking, now);
    if (category) {
      result[category].push(booking);
    }
  }

  return result;
}

/**
 * Filters bookings by event type title using case-insensitive substring matching.
 * If the filter string is empty, all bookings are returned.
 *
 * Property 5: Event type filter returns only matching bookings
 * Validates: Requirements 4.4
 */
export function filterBookingsByEventType(bookings: Booking[], filter: string): Booking[] {
  const normalizedFilter = filter.trim().toLowerCase();

  if (!normalizedFilter) {
    return bookings;
  }

  return bookings.filter((booking) =>
    booking.event_type_title.toLowerCase().includes(normalizedFilter)
  );
}
