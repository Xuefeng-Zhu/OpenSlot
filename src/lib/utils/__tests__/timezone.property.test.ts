import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { toHostTimezone, fromHostTimezone } from '../timezone'
import { validDate } from '@/test/fast-check'

/**
 * Property 7: Timezone conversion round-trip
 * For any valid UTC timestamp and any valid IANA timezone identifier,
 * converting the timestamp to the target timezone and then back to UTC
 * SHALL produce the original timestamp value (within the same instant).
 *
 * Validates: Requirements 7.8, 17.3, 17.4
 */
describe('Property 7: Timezone conversion round-trip', () => {
  const IANA_TIMEZONES = [
    'America/New_York',
    'Europe/London',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Pacific/Auckland',
    'America/Los_Angeles',
    'Europe/Berlin',
    'Asia/Kolkata',
  ] as const

  // Generate random UTC timestamps between 2020-01-01 and 2030-01-01
  const utcTimestampArb = validDate({
    min: new Date('2020-01-01T00:00:00Z'),
    max: new Date('2029-12-31T23:59:59Z'),
  })

  const timezoneArb = fc.constantFrom(...IANA_TIMEZONES)

  it('converting UTC → local → UTC produces the original timestamp', () => {
    fc.assert(
      fc.property(utcTimestampArb, timezoneArb, (utcDate, timezone) => {
        const local = toHostTimezone(utcDate, timezone)
        const backToUtc = fromHostTimezone(local, timezone)

        expect(backToUtc.getTime()).toBe(utcDate.getTime())
      }),
      { numRuns: 100 }
    )
  })
})
