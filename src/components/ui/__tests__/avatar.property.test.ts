import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getInitials } from '../avatar'

/**
 * Property 3: Avatar Initials Generation
 * Validates: Requirements 2.8
 *
 * For any non-empty name string, the Avatar component's fallback SHALL produce
 * 1–2 uppercase alphabetic characters derived from the first characters of the
 * name's words (first name initial + last name initial, or single initial for
 * single-word names).
 */

describe('Property 3: Avatar Initials Generation', () => {
  /**
   * Generate arbitrary non-empty strings that contain at least one alphabetic character.
   */
  const nameWithAlpha = fc
    .string({ minLength: 1, maxLength: 100 })
    .filter((s) => /[a-zA-Z]/.test(s))

  it('any non-empty name with alphabetic characters produces 1–2 characters', () => {
    fc.assert(
      fc.property(nameWithAlpha, (name) => {
        const initials = getInitials(name)
        expect(initials.length).toBeGreaterThanOrEqual(1)
        expect(initials.length).toBeLessThanOrEqual(2)
      }),
      { numRuns: 100 }
    )
  })

  it('all characters in the result are uppercase alphabetic [A-Z]', () => {
    fc.assert(
      fc.property(nameWithAlpha, (name) => {
        const initials = getInitials(name)
        expect(initials).toMatch(/^[A-Z]{1,2}$/)
      }),
      { numRuns: 100 }
    )
  })
})
