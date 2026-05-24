import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { computeAvailableSlots } from '../compute-slots'
import type {
  AvailabilityRule,
  AvailabilityOverride,
  TimeSlot,
  ComputeSlotsInput,
} from '../types'
import { addMinutes, addDays, parseISO } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'

// --- Generators ---

/** Generate a valid time window where start < end with at least 30 min gap */
const timeWindowArb = fc
  .record({
    startHour: fc.integer({ min: 0, max: 21 }),
    startMinute: fc.integer({ min: 0, max: 59 }),
    gapMinutes: fc.integer({ min: 30, max: 180 }),
  })
  .filter(({ startHour, startMinute, gapMinutes }) => {
    const startTotal = startHour * 60 + startMinute
    const endTotal = startTotal + gapMinutes
    return endTotal <= 23 * 60 + 59
  })
  .map(({ startHour, startMinute, gapMinutes }) => {
    const endTotal = startHour * 60 + startMinute + gapMinutes
    const endHour = Math.floor(endTotal / 60)
    const endMinute = endTotal % 60
    return {
      start: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
      end: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
    }
  })

/** Generate a weekday (0-6) */
const weekdayArb = fc.integer({ min: 0, max: 6 })

/**
 * Given a weekday (0=Sunday, 6=Saturday), generate a date string "YYYY-MM-DD"
 * that falls on that weekday. We use dates in January 2025.
 * Jan 2025: Sun=5, Mon=6, Tue=7, Wed=1, Thu=2, Fri=3, Sat=4
 */
function dateForWeekday(weekday: number): string {
  // Jan 5, 2025 is a Sunday (weekday 0)
  const baseDate = 5 // Jan 5 is Sunday
  const day = baseDate + weekday
  return `2025-01-${String(day).padStart(2, '0')}`
}

/** Use a fixed timezone to avoid DST complications in tests */
const TIMEZONE = 'UTC'

// --- Property 4: Slot computation respects availability windows ---

/**
 * Property 4: Slot computation respects availability windows
 * Validates: Requirements 7.1, 5.5, 6.2, 6.3, 6.4
 *
 * For any combination of weekly availability rules, date-specific overrides,
 * and a requested date: all returned time slots SHALL have their start and end
 * times falling entirely within a declared available window.
 * If a date-specific override marks the day as unavailable, zero slots SHALL be returned.
 */
describe('Property 4: Slot computation respects availability windows', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Set "now" to Jan 1, 2025 00:00:00 UTC — well before all test dates
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('all returned slots fall entirely within declared available windows', () => {
    fc.assert(
      fc.property(
        weekdayArb,
        timeWindowArb,
        (weekday, window) => {
          const date = dateForWeekday(weekday)
          const rules: AvailabilityRule[] = [
            {
              id: 'rule-1',
              user_id: 'user-1',
              weekday,
              start_time: window.start,
              end_time: window.end,
              timezone: TIMEZONE,
              is_active: true,
            },
          ]

          // Compute window boundaries in UTC
          const windowStartUTC = fromZonedTime(
            new Date(`${date}T${window.start}:00`),
            TIMEZONE
          )
          const windowEndUTC = fromZonedTime(
            new Date(`${date}T${window.end}:00`),
            TIMEZONE
          )

          // Use a duration that fits within the window
          const [sh, sm] = window.start.split(':').map(Number)
          const [eh, em] = window.end.split(':').map(Number)
          const windowMinutes = (eh * 60 + em) - (sh * 60 + sm)
          const durationMinutes = Math.min(30, windowMinutes)

          const input: ComputeSlotsInput = {
            date,
            hostUserId: 'user-1',
            eventTypeId: 'event-1',
            guestTimezone: TIMEZONE,
            durationMinutes,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 0,
            minNoticeMinutes: 0,
            maxBookingDaysAhead: 60,
          }

          const slots = computeAvailableSlots(input, rules, [], [], [])

          // Every slot must fall within the availability window
          for (const slot of slots) {
            const slotStart = parseISO(slot.start)
            const slotEnd = parseISO(slot.end)
            expect(slotStart.getTime()).toBeGreaterThanOrEqual(windowStartUTC.getTime())
            expect(slotEnd.getTime()).toBeLessThanOrEqual(windowEndUTC.getTime())
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns zero slots when override marks day unavailable', () => {
    fc.assert(
      fc.property(
        weekdayArb,
        timeWindowArb,
        (weekday, window) => {
          const date = dateForWeekday(weekday)
          const rules: AvailabilityRule[] = [
            {
              id: 'rule-1',
              user_id: 'user-1',
              weekday,
              start_time: window.start,
              end_time: window.end,
              timezone: TIMEZONE,
              is_active: true,
            },
          ]

          const override: AvailabilityOverride = {
            id: 'override-1',
            user_id: 'user-1',
            date,
            start_time: null,
            end_time: null,
            timezone: TIMEZONE,
            is_available: false,
            reason: 'Day off',
          }

          const input: ComputeSlotsInput = {
            date,
            hostUserId: 'user-1',
            eventTypeId: 'event-1',
            guestTimezone: TIMEZONE,
            durationMinutes: 30,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 0,
            minNoticeMinutes: 0,
            maxBookingDaysAhead: 60,
          }

          const slots = computeAvailableSlots(input, rules, [override], [], [])
          expect(slots).toHaveLength(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('slots respect override custom hours instead of weekly rules', () => {
    fc.assert(
      fc.property(
        weekdayArb,
        timeWindowArb,
        timeWindowArb,
        (weekday, ruleWindow, overrideWindow) => {
          const date = dateForWeekday(weekday)

          const rules: AvailabilityRule[] = [
            {
              id: 'rule-1',
              user_id: 'user-1',
              weekday,
              start_time: ruleWindow.start,
              end_time: ruleWindow.end,
              timezone: TIMEZONE,
              is_active: true,
            },
          ]

          const override: AvailabilityOverride = {
            id: 'override-1',
            user_id: 'user-1',
            date,
            start_time: overrideWindow.start,
            end_time: overrideWindow.end,
            timezone: TIMEZONE,
            is_available: true,
            reason: null,
          }

          // Compute override window boundaries in UTC
          const overrideStartUTC = fromZonedTime(
            new Date(`${date}T${overrideWindow.start}:00`),
            TIMEZONE
          )
          const overrideEndUTC = fromZonedTime(
            new Date(`${date}T${overrideWindow.end}:00`),
            TIMEZONE
          )

          const [sh, sm] = overrideWindow.start.split(':').map(Number)
          const [eh, em] = overrideWindow.end.split(':').map(Number)
          const windowMinutes = (eh * 60 + em) - (sh * 60 + sm)
          const durationMinutes = Math.min(30, windowMinutes)

          const input: ComputeSlotsInput = {
            date,
            hostUserId: 'user-1',
            eventTypeId: 'event-1',
            guestTimezone: TIMEZONE,
            durationMinutes,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 0,
            minNoticeMinutes: 0,
            maxBookingDaysAhead: 60,
          }

          const slots = computeAvailableSlots(input, rules, [override], [], [])

          // All slots must fall within the OVERRIDE window, not the rule window
          for (const slot of slots) {
            const slotStart = parseISO(slot.start)
            const slotEnd = parseISO(slot.end)
            expect(slotStart.getTime()).toBeGreaterThanOrEqual(overrideStartUTC.getTime())
            expect(slotEnd.getTime()).toBeLessThanOrEqual(overrideEndUTC.getTime())
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Property 5: Slot computation excludes conflicting bookings and holds ---

/**
 * Property 5: Slot computation excludes conflicting bookings and holds
 * Validates: Requirements 7.2, 7.3, 7.4, 7.7, 10.3, 13.4
 *
 * For any set of confirmed bookings and active holds, no returned time slot's
 * buffered range shall overlap with any confirmed booking or active hold.
 * Cancelled bookings shall NOT block any slots.
 */
describe('Property 5: Slot computation excludes conflicting bookings and holds', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('no returned slot buffered range overlaps any booking or hold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }), // bufferBefore (0-5 * 5 = 0-25 min)
        fc.integer({ min: 0, max: 5 }), // bufferAfter
        fc.array(
          fc.integer({ min: 0, max: 7 }), // booking slot index within the window
          { minLength: 0, maxLength: 3 }
        ),
        fc.array(
          fc.integer({ min: 0, max: 7 }), // hold slot index within the window
          { minLength: 0, maxLength: 3 }
        ),
        (bufferBeforeFactor, bufferAfterFactor, bookingIndices, holdIndices) => {
          const weekday = 1 // Monday
          const date = '2025-01-06' // Monday
          const bufferBefore = bufferBeforeFactor * 5
          const bufferAfter = bufferAfterFactor * 5
          const durationMinutes = 30

          const rules: AvailabilityRule[] = [
            {
              id: 'rule-1',
              user_id: 'user-1',
              weekday,
              start_time: '08:00',
              end_time: '12:00',
              timezone: TIMEZONE,
              is_active: true,
            },
          ]

          // Generate bookings at specific slot positions within the window
          // Window is 08:00-12:00 = 8 slots of 30 min each
          const windowStartUTC = fromZonedTime(new Date(`${date}T08:00:00`), TIMEZONE)

          const bookings: TimeSlot[] = [...new Set(bookingIndices)].map((idx) => {
            const slotIdx = idx % 8
            const start = addMinutes(windowStartUTC, slotIdx * durationMinutes)
            const end = addMinutes(start, durationMinutes)
            return { start: start.toISOString(), end: end.toISOString() }
          })

          const holds: TimeSlot[] = [...new Set(holdIndices)].map((idx) => {
            const slotIdx = idx % 8
            const start = addMinutes(windowStartUTC, slotIdx * durationMinutes)
            const end = addMinutes(start, durationMinutes)
            return { start: start.toISOString(), end: end.toISOString() }
          })

          const input: ComputeSlotsInput = {
            date,
            hostUserId: 'user-1',
            eventTypeId: 'event-1',
            guestTimezone: TIMEZONE,
            durationMinutes,
            bufferBeforeMinutes: bufferBefore,
            bufferAfterMinutes: bufferAfter,
            minNoticeMinutes: 0,
            maxBookingDaysAhead: 60,
          }

          const slots = computeAvailableSlots(input, rules, [], bookings, holds)

          // Verify: no returned slot's buffered range overlaps any booking or hold
          const allBlocked = [...bookings, ...holds]
          for (const slot of slots) {
            const slotStart = parseISO(slot.start)
            const slotEnd = parseISO(slot.end)
            const bufferedStart = addMinutes(slotStart, -bufferBefore)
            const bufferedEnd = addMinutes(slotEnd, bufferAfter)

            for (const blocked of allBlocked) {
              const blockedStart = parseISO(blocked.start)
              const blockedEnd = parseISO(blocked.end)

              // Ranges overlap if startA < endB AND startB < endA
              const overlaps =
                bufferedStart.getTime() < blockedEnd.getTime() &&
                blockedStart.getTime() < bufferedEnd.getTime()

              expect(overlaps).toBe(false)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('cancelled bookings do not block slots', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 7 }), // slot index for the "cancelled" booking
        (bookingIdx) => {
          const weekday = 1 // Monday
          const date = '2025-01-06'
          const durationMinutes = 30

          const rules: AvailabilityRule[] = [
            {
              id: 'rule-1',
              user_id: 'user-1',
              weekday,
              start_time: '08:00',
              end_time: '12:00',
              timezone: TIMEZONE,
              is_active: true,
            },
          ]

          const windowStartUTC = fromZonedTime(new Date(`${date}T08:00:00`), TIMEZONE)
          const slotIdx = bookingIdx % 8
          const bookingStart = addMinutes(windowStartUTC, slotIdx * durationMinutes)
          const bookingEnd = addMinutes(bookingStart, durationMinutes)

          // Cancelled bookings should NOT be passed to computeAvailableSlots
          // (the caller filters them out). Verify that without the booking,
          // the slot IS available.
          const input: ComputeSlotsInput = {
            date,
            hostUserId: 'user-1',
            eventTypeId: 'event-1',
            guestTimezone: TIMEZONE,
            durationMinutes,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 0,
            minNoticeMinutes: 0,
            maxBookingDaysAhead: 60,
          }

          // With no bookings, the slot at bookingIdx should be available
          const slotsWithout = computeAvailableSlots(input, rules, [], [], [])
          const targetSlotStart = bookingStart.toISOString()
          const hasSlot = slotsWithout.some((s) => s.start === targetSlotStart)
          expect(hasSlot).toBe(true)

          // With the booking passed as active, the slot should be blocked
          const booking: TimeSlot = {
            start: bookingStart.toISOString(),
            end: bookingEnd.toISOString(),
          }
          const slotsWith = computeAvailableSlots(input, rules, [], [booking], [])
          const hasSlotAfter = slotsWith.some((s) => s.start === targetSlotStart)
          expect(hasSlotAfter).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Property 6: Slot computation enforces time boundaries ---

/**
 * Property 6: Slot computation enforces time boundaries
 * Validates: Requirements 7.5, 7.6
 *
 * For any min_notice_minutes and max_booking_days_ahead values, all returned
 * time slots SHALL have a start time that is at least min_notice_minutes in
 * the future and at most max_booking_days_ahead days ahead.
 */
describe('Property 6: Slot computation enforces time boundaries', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('all returned slots start at least min_notice_minutes in the future', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120 }), // minNoticeMinutes
        (minNoticeMinutes) => {
          // Set "now" to 08:00 UTC on Jan 6, 2025 (Monday)
          vi.useFakeTimers()
          vi.setSystemTime(new Date('2025-01-06T08:00:00Z'))

          const now = new Date('2025-01-06T08:00:00Z')
          const earliestAllowed = addMinutes(now, minNoticeMinutes)

          const weekday = 1 // Monday
          const date = '2025-01-06'

          const rules: AvailabilityRule[] = [
            {
              id: 'rule-1',
              user_id: 'user-1',
              weekday,
              start_time: '06:00',
              end_time: '18:00',
              timezone: TIMEZONE,
              is_active: true,
            },
          ]

          const input: ComputeSlotsInput = {
            date,
            hostUserId: 'user-1',
            eventTypeId: 'event-1',
            guestTimezone: TIMEZONE,
            durationMinutes: 30,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 0,
            minNoticeMinutes,
            maxBookingDaysAhead: 60,
          }

          const slots = computeAvailableSlots(input, rules, [], [], [])

          for (const slot of slots) {
            const slotStart = parseISO(slot.start)
            expect(slotStart.getTime()).toBeGreaterThanOrEqual(earliestAllowed.getTime())
          }

          vi.useRealTimers()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('all returned slots start at most max_booking_days_ahead days in the future', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 90 }), // maxBookingDaysAhead
        (maxBookingDaysAhead) => {
          // Set "now" to Jan 1, 2025
          vi.useFakeTimers()
          vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))

          const now = new Date('2025-01-01T00:00:00Z')
          const latestAllowed = addDays(now, maxBookingDaysAhead)

          // Pick a date that is within the max days ahead range
          // Use a Monday within range
          const weekday = 1 // Monday
          const date = '2025-01-06'

          const rules: AvailabilityRule[] = [
            {
              id: 'rule-1',
              user_id: 'user-1',
              weekday,
              start_time: '08:00',
              end_time: '17:00',
              timezone: TIMEZONE,
              is_active: true,
            },
          ]

          const input: ComputeSlotsInput = {
            date,
            hostUserId: 'user-1',
            eventTypeId: 'event-1',
            guestTimezone: TIMEZONE,
            durationMinutes: 30,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 0,
            minNoticeMinutes: 0,
            maxBookingDaysAhead,
          }

          const slots = computeAvailableSlots(input, rules, [], [], [])

          for (const slot of slots) {
            const slotStart = parseISO(slot.start)
            expect(slotStart.getTime()).toBeLessThanOrEqual(latestAllowed.getTime())
          }

          vi.useRealTimers()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns zero slots when date is beyond max_booking_days_ahead', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // maxBookingDaysAhead (small to ensure date is beyond)
        (maxBookingDaysAhead) => {
          // Set "now" to Jan 1, 2025
          vi.useFakeTimers()
          vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))

          // Use a date far in the future (Feb 15 = 45 days ahead)
          const weekday = 6 // Saturday (Feb 15, 2025 is Saturday)
          const date = '2025-02-15'

          const rules: AvailabilityRule[] = [
            {
              id: 'rule-1',
              user_id: 'user-1',
              weekday,
              start_time: '09:00',
              end_time: '17:00',
              timezone: TIMEZONE,
              is_active: true,
            },
          ]

          const input: ComputeSlotsInput = {
            date,
            hostUserId: 'user-1',
            eventTypeId: 'event-1',
            guestTimezone: TIMEZONE,
            durationMinutes: 30,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 0,
            minNoticeMinutes: 0,
            maxBookingDaysAhead,
          }

          const slots = computeAvailableSlots(input, rules, [], [], [])
          expect(slots).toHaveLength(0)

          vi.useRealTimers()
        }
      ),
      { numRuns: 100 }
    )
  })
})
