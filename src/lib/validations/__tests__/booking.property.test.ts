import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  confirmBookingSchema,
  createHoldSchema,
  rescheduleBookingSchema,
} from '@/lib/validations/booking'
import { stringOf } from '@/test/fast-check'

/**
 * Property 8: Booking form validation correctness
 * Validates: Requirements 11.7, 3.2
 *
 * Tests that the confirmBookingSchema accepts input iff:
 * - holdToken is a valid UUID
 * - guestName is non-empty (1-100 chars)
 * - guestEmail is a valid email format
 * - guestTimezone is a valid IANA timezone
 */
describe('Property 8: Booking form validation correctness', () => {
  const validTimezones = Intl.supportedValuesOf('timeZone')

  const validUuidArb = fc.uuid()

  const validGuestNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter(
    (s) => s.trim().length > 0
  )

  const validEmailArb = fc
    .tuple(
      stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
        minLength: 1,
        maxLength: 10,
      }),
      stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
        minLength: 1,
        maxLength: 10,
      }),
      fc.constantFrom('com', 'org', 'net', 'io', 'dev')
    )
    .map(([local, domain, tld]) => `${local}@${domain}.${tld}`)

  const validTimezoneArb = fc.constantFrom(...validTimezones)

  describe('accepts valid inputs', () => {
    it('accepts input when holdToken is UUID, guestName is non-empty, guestEmail is valid email, and guestTimezone is valid IANA timezone', () => {
      fc.assert(
        fc.property(
          validUuidArb,
          validGuestNameArb,
          validEmailArb,
          validTimezoneArb,
          (holdToken, guestName, guestEmail, guestTimezone) => {
            const result = confirmBookingSchema.safeParse({
              holdToken,
              guestName,
              guestEmail,
              guestTimezone,
            })
            expect(result.success).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('rejects invalid holdToken', () => {
    it('rejects non-UUID holdToken strings', () => {
      const nonUuidArb = fc
        .string({ minLength: 1, maxLength: 50 })
        .filter((s) => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          return !uuidRegex.test(s)
        })

      fc.assert(
        fc.property(
          nonUuidArb,
          validGuestNameArb,
          validEmailArb,
          validTimezoneArb,
          (holdToken, guestName, guestEmail, guestTimezone) => {
            const result = confirmBookingSchema.safeParse({
              holdToken,
              guestName,
              guestEmail,
              guestTimezone,
            })
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('rejects empty guestName', () => {
    it('rejects empty string for guestName', () => {
      fc.assert(
        fc.property(
          validUuidArb,
          validEmailArb,
          validTimezoneArb,
          (holdToken, guestEmail, guestTimezone) => {
            const result = confirmBookingSchema.safeParse({
              holdToken,
              guestName: '',
              guestEmail,
              guestTimezone,
            })
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects guestName values that are blank after trimming', () => {
      fc.assert(
        fc.property(
          validUuidArb,
          validEmailArb,
          validTimezoneArb,
          stringOf(fc.constantFrom(' ', '\t', '\n'), {
            minLength: 1,
            maxLength: 20,
          }),
          (holdToken, guestEmail, guestTimezone, guestName) => {
            const result = confirmBookingSchema.safeParse({
              holdToken,
              guestName,
              guestEmail,
              guestTimezone,
            })
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('rejects invalid guestEmail', () => {
    it('rejects strings that are not valid email format', () => {
      const invalidEmailArb = fc.oneof(
        stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
          minLength: 1,
          maxLength: 20,
        }),
        stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
          minLength: 1,
          maxLength: 10,
        })
          .map((s) => `${s}@`),
        stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
          minLength: 1,
          maxLength: 10,
        })
          .map((s) => `@${s}.com`),
        fc
          .tuple(
            stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
              minLength: 1,
              maxLength: 5,
            }),
            stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
              minLength: 1,
              maxLength: 5,
            })
          )
          .map(([a, b]) => `${a}@@${b}.com`)
      )

      fc.assert(
        fc.property(
          validUuidArb,
          validGuestNameArb,
          invalidEmailArb,
          validTimezoneArb,
          (holdToken, guestName, guestEmail, guestTimezone) => {
            const result = confirmBookingSchema.safeParse({
              holdToken,
              guestName,
              guestEmail,
              guestTimezone,
            })
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('normalizes guest identity fields', () => {
    it('trims guest name and email before confirming a booking', () => {
      fc.assert(
        fc.property(
          validUuidArb,
          validGuestNameArb,
          validEmailArb,
          validTimezoneArb,
          (holdToken, guestName, guestEmail, guestTimezone) => {
            const result = confirmBookingSchema.safeParse({
              holdToken,
              guestName: ` ${guestName} `,
              guestEmail: `\n${guestEmail}\t`,
              guestTimezone,
            })

            expect(result.success).toBe(true)
            if (result.success) {
              expect(result.data.guestName).toBe(guestName.trim())
              expect(result.data.guestEmail).toBe(guestEmail)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('trims guest email before creating a hold', () => {
      const result = createHoldSchema.safeParse({
        eventTypeId: '550e8400-e29b-41d4-a716-446655440001',
        hostUserId: '550e8400-e29b-41d4-a716-446655440002',
        startAt: '2026-06-01T15:00:00.000Z',
        endAt: '2026-06-01T15:30:00.000Z',
        guestEmail: '  jane@example.com  ',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.guestEmail).toBe('jane@example.com')
      }
    })

    it('trims guest name and email before rescheduling a booking', () => {
      const result = rescheduleBookingSchema.safeParse({
        rescheduleToken: '550e8400-e29b-41d4-a716-446655440003',
        holdToken: '550e8400-e29b-41d4-a716-446655440004',
        guestName: '  Jane Doe  ',
        guestEmail: ' jane@example.com\n',
        guestTimezone: 'America/New_York',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.guestName).toBe('Jane Doe')
        expect(result.data.guestEmail).toBe('jane@example.com')
      }
    })
  })
})
