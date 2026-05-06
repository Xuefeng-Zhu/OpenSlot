import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateTimeInterval } from '../availability-day-row'

/**
 * Property 10: Time Interval Validation
 * Validates: Requirements 8.9
 *
 * For any time interval where the end time is less than or equal to the start time,
 * the AvailabilityDayRow component SHALL display a validation error message
 * and the Availability Editor SHALL prevent saving.
 */

/** Generate a valid "HH:mm" time string from hour (0-23) and minute (0-59) */
const timeStringArb = fc
  .record({
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
  })
  .map(({ hour, minute }) => {
    const hh = hour.toString().padStart(2, '0')
    const mm = minute.toString().padStart(2, '0')
    return `${hh}:${mm}`
  })

/** Convert "HH:mm" to total minutes for comparison */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

describe('Property 10: Time Interval Validation', () => {
  it('invalid intervals (end <= start) always produce a non-null validation error', () => {
    fc.assert(
      fc.property(timeStringArb, timeStringArb, (start, end) => {
        // Only test cases where end <= start (invalid interval)
        fc.pre(end <= start)
        const result = validateTimeInterval(start, end)
        expect(result).not.toBeNull()
        expect(typeof result).toBe('string')
        expect(result!.length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })

  it('valid intervals (end > start) always return null (no error)', () => {
    fc.assert(
      fc.property(timeStringArb, timeStringArb, (start, end) => {
        // Only test cases where end > start (valid interval)
        fc.pre(end > start)
        const result = validateTimeInterval(start, end)
        expect(result).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  it('equal start and end times always produce a validation error', () => {
    fc.assert(
      fc.property(timeStringArb, (time) => {
        const result = validateTimeInterval(time, time)
        expect(result).not.toBeNull()
        expect(typeof result).toBe('string')
        expect(result!.length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })
})
