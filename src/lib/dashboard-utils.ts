/**
 * Returns at most `maxItems` bookings from the provided list.
 * Used to bound the "Next bookings" display to 5 items.
 *
 * Property 9: Bounded Booking List Display
 * For any list of N upcoming bookings (where N ≥ 0), the Dashboard Overview's
 * "Next bookings" section SHALL display exactly min(N, 5) booking items.
 */
export function getDisplayedBookings<T>(bookings: T[], maxItems: number = 5): T[] {
  return bookings.slice(0, maxItems);
}
