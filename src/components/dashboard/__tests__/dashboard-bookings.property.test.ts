import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getDisplayedBookings } from "@/lib/dashboard-utils";

/**
 * Property 9: Bounded Booking List Display
 *
 * For any list of N upcoming bookings (where N ≥ 0), the Dashboard Overview's
 * "Next bookings" section SHALL display exactly min(N, 5) booking items.
 *
 * **Validates: Requirements 7.4**
 */
describe("Property 9: Bounded Booking List Display", () => {
  it("should display exactly min(N, 5) items for any N ≥ 0", () => {
    const bookingArb = fc.record({
      id: fc.uuid(),
      guestName: fc.string({ minLength: 1 }),
      eventTitle: fc.string({ minLength: 1 }),
      date: fc.string({ minLength: 1 }),
      time: fc.string({ minLength: 1 }),
    });

    fc.assert(
      fc.property(fc.array(bookingArb), (bookings) => {
        const displayed = getDisplayedBookings(bookings);
        const expected = Math.min(bookings.length, 5);
        expect(displayed.length).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it("should return the first min(N, maxItems) items preserving order", () => {
    const bookingArb = fc.record({
      id: fc.uuid(),
      guestName: fc.string({ minLength: 1 }),
      eventTitle: fc.string({ minLength: 1 }),
      date: fc.string({ minLength: 1 }),
      time: fc.string({ minLength: 1 }),
    });

    fc.assert(
      fc.property(
        fc.array(bookingArb),
        fc.integer({ min: 0, max: 20 }),
        (bookings, maxItems) => {
          const displayed = getDisplayedBookings(bookings, maxItems);
          const expected = Math.min(bookings.length, maxItems);
          expect(displayed.length).toBe(expected);
          // Verify order is preserved
          for (let i = 0; i < displayed.length; i++) {
            expect(displayed[i]).toBe(bookings[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should return empty array for empty input", () => {
    const displayed = getDisplayedBookings([]);
    expect(displayed.length).toBe(0);
  });

  it("should never exceed 5 items with default maxItems", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
        (items) => {
          const displayed = getDisplayedBookings(items);
          expect(displayed.length).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });
});
