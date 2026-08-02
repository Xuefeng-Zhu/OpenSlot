import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { profileSchema, isValidTimezone } from '@/lib/validations/profile'
import { preferencesSettingsPatchSchema } from '@/lib/validations/settings'
import { char, stringOf } from '@/test/fast-check'

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
          stringOf(
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
          stringOf(
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
      const invalidCharArb = char().filter(
        (c) => !usernameRegex.test(c)
      )

      fc.assert(
        fc.property(
          fc.tuple(
            stringOf(
              fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
              { minLength: 1, maxLength: 14 }
            ),
            invalidCharArb,
            stringOf(
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
          stringOf(
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
          stringOf(
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
    const isRuntimeAcceptedTimezone = (timezone: string) => {
      const candidate = timezone.trim()
      if (!candidate) {
        return false
      }

      try {
        Intl.DateTimeFormat(undefined, { timeZone: candidate })
        return true
      } catch {
        return false
      }
    }

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

    it('accepts the UTC default timezone', () => {
      expect(isValidTimezone('UTC')).toBe(true)
    })

    it('rejects random strings that Intl cannot resolve as timezones', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(
            (timezone) => !isRuntimeAcceptedTimezone(timezone)
          ),
          (timezone) => {
            expect(isValidTimezone(timezone)).toBe(false)
            expect(
              preferencesSettingsPatchSchema.shape.defaultTimezone.safeParse(
                timezone
              ).success
            ).toBe(false)
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
          stringOf(fc.constantFrom(' ', '\t', '\n'), {
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
