import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { computeRemainingSeconds } from '../hold-timer'
import { validDate } from '@/test/fast-check'

/**
 * Property 11: Hold Timer Countdown Computation
 * Validates: Requirements 13.6
 *
 * For any expiration timestamp, the shared hold timer helper SHALL compute
 * the remaining seconds as max(0, floor((expiresAt - now) / 1000)).
 */

describe('Property 11: Hold Timer Countdown Computation', () => {
  it('for any future timestamp, result equals floor((expiresAt - now) / 1000)', () => {
    fc.assert(
      fc.property(
        validDate({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
        fc.integer({ min: 1, max: 86400000 }), // 1ms to 24 hours offset
        (now, offsetMs) => {
          const expiresAt = new Date(now.getTime() + offsetMs)
          const result = computeRemainingSeconds(expiresAt.toISOString(), now)
          const expected = Math.floor(offsetMs / 1000)
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('for any past timestamp (expiresAt <= now), result is always 0', () => {
    fc.assert(
      fc.property(
        validDate({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
        fc.integer({ min: 0, max: 86400000 }), // 0ms to 24 hours in the past
        (now, offsetMs) => {
          const expiresAt = new Date(now.getTime() - offsetMs)
          const result = computeRemainingSeconds(expiresAt.toISOString(), now)
          expect(result).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result is always >= 0 (never negative)', () => {
    fc.assert(
      fc.property(
        validDate({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
        fc.integer({ min: -86400000, max: 86400000 }), // any offset
        (now, offsetMs) => {
          const expiresAt = new Date(now.getTime() + offsetMs)
          const result = computeRemainingSeconds(expiresAt.toISOString(), now)
          expect(result).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
