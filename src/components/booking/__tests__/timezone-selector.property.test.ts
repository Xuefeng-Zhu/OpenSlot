import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { filterTimezones } from '../timezone-selector'

/**
 * Property 4: Timezone Filter Correctness
 * Validates: Requirements 2.12
 *
 * For any non-empty search query string, all timezone options returned by the
 * TimezoneSelector's filter function SHALL contain the query as a case-insensitive
 * substring of the timezone identifier.
 */

// A representative list of real IANA timezone identifiers
const IANA_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Europe/Rome',
  'Europe/Madrid',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Seoul',
  'Asia/Hong_Kong',
  'Asia/Bangkok',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
  'Pacific/Honolulu',
  'Pacific/Fiji',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Indian/Maldives',
  'Atlantic/Reykjavik',
  'UTC',
]

describe('Property 4: Timezone Filter Correctness', () => {
  // Generator for non-empty query strings
  const nonEmptyQuery = fc.string({ minLength: 1, maxLength: 30 })

  // Generator for sublists of IANA timezones (at least 1 element)
  const timezoneSubset = fc.shuffledSubarray(IANA_TIMEZONES, { minLength: 1 })

  it('all returned options contain the query as a case-insensitive substring', () => {
    fc.assert(
      fc.property(timezoneSubset, nonEmptyQuery, (timezones, query) => {
        const results = filterTimezones(timezones, query)

        const lowerQuery = query.trim().toLowerCase()
        for (const tz of results) {
          expect(tz.toLowerCase()).toContain(lowerQuery)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('the result is always a subset of the input list', () => {
    fc.assert(
      fc.property(timezoneSubset, nonEmptyQuery, (timezones, query) => {
        const results = filterTimezones(timezones, query)

        for (const tz of results) {
          expect(timezones).toContain(tz)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('an empty or whitespace-only query returns the full input list unchanged', () => {
    fc.assert(
      fc.property(
        timezoneSubset,
        fc.constantFrom('', ' ', '   ', '\t', '\n'),
        (timezones, query) => {
          const results = filterTimezones(timezones, query)
          expect(results).toEqual(timezones)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('trims leading and trailing query whitespace before matching', () => {
    expect(filterTimezones(IANA_TIMEZONES, '  America/New_York  ')).toEqual([
      'America/New_York',
    ])
  })
})
