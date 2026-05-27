import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getDisplayedBookings } from "@/lib/dashboard-utils";
import { validDate } from "@/test/fast-check";

/**
 * Feature: ui-backend-integration, Property 3: Dashboard bookings are ordered by start time ascending
 * Validates: Requirements 3.6
 *
 * For any array of upcoming bookings with distinct `start_at` timestamps,
 * the dashboard page SHALL render them in ascending chronological order (earliest first).
 *
 * The server component fetches bookings ordered by `start_at` ascending and passes them
 * to the client. The `getDisplayedBookings` utility limits the displayed count.
 * This test verifies that the utility preserves the ascending order.
 */
describe("Feature: ui-backend-integration, Property 3: Dashboard bookings are ordered by start time ascending", () => {
  // Generator for a booking with a specific start_at timestamp
  const bookingWithTimestamp = (startAt: Date) => ({
    id: crypto.randomUUID(),
    guest_name: "Guest",
    start_at: startAt.toISOString(),
    end_at: new Date(startAt.getTime() + 30 * 60 * 1000).toISOString(),
    event_type_title: "Meeting",
  });

  // Generator for an array of distinct timestamps, sorted ascending
  const sortedDistinctDatesArb = fc
    .uniqueArray(
      validDate({
        min: new Date("2024-01-01T00:00:00Z"),
        max: new Date("2026-12-31T23:59:59Z"),
      }),
      { minLength: 1, maxLength: 20, selector: (d) => d.getTime() }
    )
    .map((dates) => [...dates].sort((a, b) => a.getTime() - b.getTime()));

  it("getDisplayedBookings preserves ascending start_at order", () => {
    fc.assert(
      fc.property(sortedDistinctDatesArb, (sortedDates) => {
        const bookings = sortedDates.map((d) => bookingWithTimestamp(d));
        const displayed = getDisplayedBookings(bookings);

        // Verify the displayed bookings are in ascending order by start_at
        for (let i = 1; i < displayed.length; i++) {
          const prev = new Date(displayed[i - 1].start_at).getTime();
          const curr = new Date(displayed[i].start_at).getTime();
          expect(curr).toBeGreaterThan(prev);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("unsorted bookings passed through getDisplayedBookings retain their input order", () => {
    // This test verifies that getDisplayedBookings does NOT re-sort;
    // it preserves whatever order is given. The server is responsible for sorting.
    const unsortedDatesArb = fc.uniqueArray(
      validDate({
        min: new Date("2024-01-01T00:00:00Z"),
        max: new Date("2026-12-31T23:59:59Z"),
      }),
      { minLength: 2, maxLength: 20, selector: (d) => d.getTime() }
    );

    fc.assert(
      fc.property(unsortedDatesArb, (dates) => {
        const bookings = dates.map((d) => bookingWithTimestamp(d));
        const displayed = getDisplayedBookings(bookings);

        // Verify order is preserved from input (same references)
        for (let i = 0; i < displayed.length; i++) {
          expect(displayed[i]).toBe(bookings[i]);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("when input is sorted ascending, output is also sorted ascending regardless of array size", () => {
    const largeSortedDatesArb = fc
      .uniqueArray(
        validDate({
          min: new Date("2024-01-01T00:00:00Z"),
          max: new Date("2026-12-31T23:59:59Z"),
        }),
        { minLength: 1, maxLength: 50, selector: (d) => d.getTime() }
      )
      .map((dates) => [...dates].sort((a, b) => a.getTime() - b.getTime()));

    fc.assert(
      fc.property(largeSortedDatesArb, (sortedDates) => {
        const bookings = sortedDates.map((d) => bookingWithTimestamp(d));
        const displayed = getDisplayedBookings(bookings);

        // All displayed items should be in ascending order
        for (let i = 1; i < displayed.length; i++) {
          const prev = new Date(displayed[i - 1].start_at).getTime();
          const curr = new Date(displayed[i].start_at).getTime();
          expect(curr).toBeGreaterThan(prev);
        }

        // Displayed items should be bounded by maxItems (default 5)
        const maxItems = 5;
        const expectedCount = Math.min(bookings.length, maxItems);
        expect(displayed.length).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });
});
