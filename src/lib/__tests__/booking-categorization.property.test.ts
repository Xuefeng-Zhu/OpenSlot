import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { categorizeBooking, type Booking } from '../booking-utils'

/**
 * Property 4: Booking categorization correctness
 * Feature: ui-backend-integration, Property 4: Booking categorization correctness
 * Validates: Requirements 4.2
 */

// Fixed reference time for deterministic testing
const NOW = new Date('2025-06-15T12:00:00Z')

// Arbitrary for generating a base booking with all required fields
const baseBookingArb = fc.record({
  id: fc.uuid(),
  guest_name: fc.string({ minLength: 1, maxLength: 50 }),
  guest_email: fc.emailAddress(),
  guest_timezone: fc.constantFrom('America/New_York', 'Europe/London', 'Asia/Tokyo', 'UTC'),
  notes: fc.string({ minLength: 0, maxLength: 200 }),
  end_at: fc.constant('2025-06-15T13:00:00Z'),
  cancellation_token: fc.uuid(),
  event_type_title: fc.string({ minLength: 1, maxLength: 100 }),
})

// Generate a future timestamp (after NOW)
const futureTimestampArb = fc
  .integer({ min: 1, max: 365 * 24 * 60 })
  .map((minutesAhead) => {
    const date = new Date(NOW.getTime() + minutesAhead * 60 * 1000)
    return date.toISOString()
  })

// Generate a past timestamp (before NOW)
const pastTimestampArb = fc
  .integer({ min: 1, max: 365 * 24 * 60 })
  .map((minutesBehind) => {
    const date = new Date(NOW.getTime() - minutesBehind * 60 * 1000)
    return date.toISOString()
  })

// Generate a status that is neither 'confirmed' nor 'cancelled'
const otherStatusArb = fc.constantFrom('pending', 'no_show', 'rescheduled', 'expired', 'unknown')

describe('Property 4: Booking categorization correctness', () => {
  it('categorizes confirmed + future bookings as "upcoming"', () => {
    fc.assert(
      fc.property(baseBookingArb, futureTimestampArb, (base, startAt) => {
        const booking: Booking = {
          ...base,
          status: 'confirmed',
          start_at: startAt,
        }

        const result = categorizeBooking(booking, NOW)
        expect(result).toBe('upcoming')
      }),
      { numRuns: 100 }
    )
  })

  it('categorizes confirmed + past bookings as "past"', () => {
    fc.assert(
      fc.property(baseBookingArb, pastTimestampArb, (base, startAt) => {
        const booking: Booking = {
          ...base,
          status: 'confirmed',
          start_at: startAt,
        }

        const result = categorizeBooking(booking, NOW)
        expect(result).toBe('past')
      }),
      { numRuns: 100 }
    )
  })

  it('categorizes cancelled bookings as "cancelled" regardless of start_at', () => {
    fc.assert(
      fc.property(
        baseBookingArb,
        fc.oneof(futureTimestampArb, pastTimestampArb),
        (base, startAt) => {
          const booking: Booking = {
            ...base,
            status: 'cancelled',
            start_at: startAt,
          }

          const result = categorizeBooking(booking, NOW)
          expect(result).toBe('cancelled')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns null for bookings with statuses other than confirmed or cancelled', () => {
    fc.assert(
      fc.property(
        baseBookingArb,
        fc.oneof(futureTimestampArb, pastTimestampArb),
        otherStatusArb,
        (base, startAt, status) => {
          const booking: Booking = {
            ...base,
            status,
            start_at: startAt,
          }

          const result = categorizeBooking(booking, NOW)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('categorization is exhaustive: every booking gets exactly one of upcoming/past/cancelled/null', () => {
    const anyStatusArb = fc.oneof(
      fc.constant('confirmed'),
      fc.constant('cancelled'),
      otherStatusArb
    )

    fc.assert(
      fc.property(
        baseBookingArb,
        fc.oneof(futureTimestampArb, pastTimestampArb),
        anyStatusArb,
        (base, startAt, status) => {
          const booking: Booking = {
            ...base,
            status,
            start_at: startAt,
          }

          const result = categorizeBooking(booking, NOW)

          // Result must be one of the valid categories or null
          expect(['upcoming', 'past', 'cancelled', null]).toContain(result)

          // Verify the categorization matches the rules
          if (status === 'cancelled') {
            expect(result).toBe('cancelled')
          } else if (status === 'confirmed') {
            const startDate = new Date(startAt)
            if (startDate > NOW) {
              expect(result).toBe('upcoming')
            } else {
              expect(result).toBe('past')
            }
          } else {
            expect(result).toBeNull()
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
