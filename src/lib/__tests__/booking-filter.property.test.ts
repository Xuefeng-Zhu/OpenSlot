import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { filterBookingsByEventType, type Booking } from '../booking-utils'

/**
 * Property 5: Event type filter returns only matching bookings
 * Feature: ui-backend-integration, Property 5: Event type filter returns only matching bookings
 * Validates: Requirements 4.4
 */

// Arbitrary for generating a base booking with all required fields
const baseBookingArb = fc.record({
  id: fc.uuid(),
  guest_name: fc.string({ minLength: 1, maxLength: 50 }),
  guest_email: fc.emailAddress(),
  guest_timezone: fc.constantFrom('America/New_York', 'Europe/London', 'Asia/Tokyo', 'UTC'),
  notes: fc.string({ minLength: 0, maxLength: 200 }),
  start_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }).map((d) => d.toISOString()),
  end_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }).map((d) => d.toISOString()),
  status: fc.constantFrom('confirmed', 'cancelled', 'pending'),
  cancellation_token: fc.uuid(),
  event_type_title: fc.string({ minLength: 1, maxLength: 100 }),
})

// Generate a non-empty, non-whitespace filter string
const nonEmptyFilterArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0)

// Generate an array of bookings
const bookingsArrayArb = fc.array(baseBookingArb, { minLength: 0, maxLength: 20 })

describe('Property 5: Event type filter returns only matching bookings', () => {
  it('filtered result contains ONLY bookings whose title includes the filter (no false positives)', () => {
    fc.assert(
      fc.property(bookingsArrayArb, nonEmptyFilterArb, (bookings, filter) => {
        const result = filterBookingsByEventType(bookings, filter)

        // Every booking in the result must have a title that includes the filter (case-insensitive)
        for (const booking of result) {
          expect(booking.event_type_title.toLowerCase()).toContain(filter.toLowerCase())
        }
      }),
      { numRuns: 100 }
    )
  })

  it('filtered result contains ALL bookings whose title includes the filter (no false negatives)', () => {
    fc.assert(
      fc.property(bookingsArrayArb, nonEmptyFilterArb, (bookings, filter) => {
        const result = filterBookingsByEventType(bookings, filter)

        // Every booking from the original array that matches should be in the result
        const expected = bookings.filter((b) =>
          b.event_type_title.toLowerCase().includes(filter.toLowerCase())
        )

        expect(result).toHaveLength(expected.length)
        for (const booking of expected) {
          expect(result).toContainEqual(booking)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('empty or whitespace-only filter returns all bookings', () => {
    const whitespaceFilterArb = fc.constantFrom('', ' ', '  ', '\t', '\n', '   ')

    fc.assert(
      fc.property(bookingsArrayArb, whitespaceFilterArb, (bookings, filter) => {
        const result = filterBookingsByEventType(bookings, filter)

        expect(result).toHaveLength(bookings.length)
        expect(result).toEqual(bookings)
      }),
      { numRuns: 100 }
    )
  })

  it('trims leading and trailing filter whitespace before matching', () => {
    const targetBooking: Booking = {
      id: 'target-id',
      guest_name: 'Test Guest',
      guest_email: 'test@example.com',
      guest_timezone: 'UTC',
      notes: '',
      start_at: '2025-06-15T10:00:00Z',
      end_at: '2025-06-15T11:00:00Z',
      status: 'confirmed',
      cancellation_token: 'token-123',
      event_type_title: 'Discovery Call',
    }
    const otherBooking: Booking = {
      ...targetBooking,
      id: 'other-id',
      event_type_title: 'Strategy Session',
    }

    expect(
      filterBookingsByEventType([targetBooking, otherBooking], '  discovery  ')
    ).toEqual([targetBooking])
  })

  it('filter is case-insensitive', () => {
    // Generate bookings with known titles and filters that are substrings with varied casing
    const titleArb = fc.string({ minLength: 2, maxLength: 50 }).filter((s) => s.trim().length > 0)

    fc.assert(
      fc.property(titleArb, fc.array(baseBookingArb, { minLength: 1, maxLength: 10 }), (title, otherBookings) => {
        // Create a booking with the known title
        const targetBooking: Booking = {
          id: 'target-id',
          guest_name: 'Test Guest',
          guest_email: 'test@example.com',
          guest_timezone: 'UTC',
          notes: '',
          start_at: '2025-06-15T10:00:00Z',
          end_at: '2025-06-15T11:00:00Z',
          status: 'confirmed',
          cancellation_token: 'token-123',
          event_type_title: title,
        }

        const allBookings = [targetBooking, ...otherBookings]

        // Filter with uppercase version of the title
        const upperResult = filterBookingsByEventType(allBookings, title.toUpperCase())
        // Filter with lowercase version of the title
        const lowerResult = filterBookingsByEventType(allBookings, title.toLowerCase())

        // Both should return the same set of bookings
        expect(upperResult).toHaveLength(lowerResult.length)

        // The target booking should be in both results
        expect(upperResult).toContainEqual(targetBooking)
        expect(lowerResult).toContainEqual(targetBooking)
      }),
      { numRuns: 100 }
    )
  })
})
