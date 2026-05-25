import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { profileSchema, isValidTimezone } from '@/lib/validations/profile'

/**
 * Property 2: Username and timezone validation correctness
 * Validates: Requirements 3.4, 3.5
 */
describe('Property 2: Username and timezone validation correctness', () => {
  const usernameRegex = /^[a-z0-9-]+$/

  describe('Username validation', () => {
    it('accepts strings matching ^[a-z0-9-]+$ with length 3-30', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
            { minLength: 3, maxLength: 30 }
          ),
          (username) => {
            const result = profileSchema.shape.username.safeParse(username)
            expect(result.success).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('trims surrounding username whitespace before validation', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
            { minLength: 3, maxLength: 30 }
          ),
          (username) => {
            const result = profileSchema.shape.username.safeParse(` ${username}\n`)
            expect(result.success).toBe(true)
            if (result.success) {
              expect(result.data).toBe(username)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects strings that do not match the pattern', () => {
      // Generate strings containing at least one invalid character
      const invalidCharArb = fc.char().filter(
        (c) => !usernameRegex.test(c)
      )

      fc.assert(
        fc.property(
          fc.tuple(
            fc.stringOf(
              fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
              { minLength: 1, maxLength: 14 }
            ),
            invalidCharArb,
            fc.stringOf(
              fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
              { minLength: 1, maxLength: 14 }
            )
          ),
          ([prefix, invalidChar, suffix]) => {
            const username = prefix + invalidChar + suffix
            const result = profileSchema.shape.username.safeParse(username)
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects strings shorter than 3 characters', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
            { minLength: 1, maxLength: 2 }
          ),
          (username) => {
            const result = profileSchema.shape.username.safeParse(username)
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects strings longer than 30 characters', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
            { minLength: 31, maxLength: 60 }
          ),
          (username) => {
            const result = profileSchema.shape.username.safeParse(username)
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Timezone validation', () => {
    it('accepts valid IANA timezone identifiers', () => {
      const validTimezones = Intl.supportedValuesOf('timeZone')

      fc.assert(
        fc.property(
          fc.constantFrom(...validTimezones),
          (timezone) => {
            expect(isValidTimezone(timezone)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects random strings that are not valid IANA timezones', () => {
      const validTimezones = new Set(Intl.supportedValuesOf('timeZone'))

      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(
            (s) => !validTimezones.has(s)
          ),
          (timezone) => {
            expect(isValidTimezone(timezone)).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Name validation', () => {
    it('trims surrounding name whitespace before returning parsed values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(
            (name) => name.trim().length > 0 && name.trim().length <= 100
          ),
          (name) => {
            const result = profileSchema.shape.name.safeParse(` ${name} `)
            expect(result.success).toBe(true)
            if (result.success) {
              expect(result.data).toBe(name.trim())
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects names that are blank after trimming', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n'), {
            minLength: 1,
            maxLength: 20,
          }),
          (name) => {
            const result = profileSchema.shape.name.safeParse(name)
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
