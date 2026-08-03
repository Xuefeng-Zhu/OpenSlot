import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { toHostTimezone, fromHostTimezone } from '../timezone'
import { validDate } from '@/test/fast-check'

/**
 * Property 7: Timezone conversion round-trip
 * For any valid UTC timestamp and any valid IANA timezone identifier,
 * converting the timestamp to the target timezone and canonicalizing it back
 * to UTC SHALL preserve the local wall-clock value. During a repeated DST
 * hour, two UTC instants legitimately map to the same wall time, so the
 * inverse cannot always recover the original instant without an offset or
 * explicit disambiguation policy.
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

  const utcTimestampArb = validDate({
    min: new Date('2020-01-01T00:00:00Z'),
    max: new Date('2029-12-31T23:59:59Z'),
  })

  const timezoneArb = fc.constantFrom(...IANA_TIMEZONES)

  it('converting UTC → local → canonical UTC preserves the wall time', () => {
    fc.assert(
      fc.property(utcTimestampArb, timezoneArb, (utcDate, timezone) => {
        const local = toHostTimezone(utcDate, timezone)
        const canonicalUtc = fromHostTimezone(local, timezone)
        const canonicalLocal = toHostTimezone(canonicalUtc, timezone)

        expect(canonicalLocal.getTime()).toBe(local.getTime())
      }),
      { numRuns: 100 }
    )
  })

  it('preserves the wall time during an Auckland repeated DST hour', () => {
    const utcDate = new Date('2027-04-03T13:00:00.000Z')
    const local = toHostTimezone(utcDate, 'Pacific/Auckland')
    const canonicalUtc = fromHostTimezone(local, 'Pacific/Auckland')

    expect(
      toHostTimezone(canonicalUtc, 'Pacific/Auckland').getTime()
    ).toBe(local.getTime())
  })
})
