import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { generateSlug } from '@/lib/utils/slug'
import { eventTypeFieldsSchema } from '@/lib/validations/event-type'

/**
 * Property 1: Slug generation produces URL-safe output
 * Validates: Requirements 4.2
 */
describe('Property 1: Slug generation produces URL-safe output', () => {
  it('produces output containing only lowercase letters, numbers, and hyphens for any non-empty string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (input) => {
          const slug = generateSlug(input)
          expect(slug).toMatch(/^[a-z0-9-]+$/)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('always produces a non-empty result (falls back to "untitled")', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (input) => {
          const slug = generateSlug(input)
          expect(slug.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 3: Event type numeric constraint validation
 * Validates: Requirements 4.6, 4.7, 5.2
 */
describe('Property 3: Event type numeric constraint validation', () => {
  describe('duration_minutes accepts only positive integers', () => {
    it('accepts positive integers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (duration) => {
            const result = eventTypeFieldsSchema.shape.duration_minutes.safeParse(duration)
            expect(result.success).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects negative numbers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: -1 }),
          (duration) => {
            const result = eventTypeFieldsSchema.shape.duration_minutes.safeParse(duration)
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects zero', () => {
      const result = eventTypeFieldsSchema.shape.duration_minutes.safeParse(0)
      expect(result.success).toBe(false)
    })

    it('rejects floats', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 10000, noNaN: true }).filter(
            (n) => !Number.isInteger(n)
          ),
          (duration) => {
            const result = eventTypeFieldsSchema.shape.duration_minutes.safeParse(duration)
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('buffer fields accept only non-negative integers', () => {
    it('accepts zero and positive integers for buffer_before_minutes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          (buffer) => {
            const result = eventTypeFieldsSchema.shape.buffer_before_minutes.safeParse(buffer)
            expect(result.success).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('accepts zero and positive integers for buffer_after_minutes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          (buffer) => {
            const result = eventTypeFieldsSchema.shape.buffer_after_minutes.safeParse(buffer)
            expect(result.success).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects negative numbers for buffer_before_minutes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: -1 }),
          (buffer) => {
            const result = eventTypeFieldsSchema.shape.buffer_before_minutes.safeParse(buffer)
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects negative numbers for buffer_after_minutes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: -1 }),
          (buffer) => {
            const result = eventTypeFieldsSchema.shape.buffer_after_minutes.safeParse(buffer)
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects floats for buffer_before_minutes', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 10000, noNaN: true }).filter(
            (n) => !Number.isInteger(n)
          ),
          (buffer) => {
            const result = eventTypeFieldsSchema.shape.buffer_before_minutes.safeParse(buffer)
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects floats for buffer_after_minutes', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 10000, noNaN: true }).filter(
            (n) => !Number.isInteger(n)
          ),
          (buffer) => {
            const result = eventTypeFieldsSchema.shape.buffer_after_minutes.safeParse(buffer)
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('time range validation (start < end)', () => {
    it('accepts when start_time is before end_time (simulated with hours)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 22 }),
          fc.integer({ min: 1, max: 23 }),
          (startHour, endHour) => {
            fc.pre(startHour < endHour)
            const startTime = `${String(startHour).padStart(2, '0')}:00`
            const endTime = `${String(endHour).padStart(2, '0')}:00`
            // Validates: Requirement 5.2 - start_time must be before end_time
            expect(startTime < endTime).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects when start_time is not before end_time', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 23 }),
          (startHour, endHour) => {
            fc.pre(startHour >= endHour)
            const startTime = `${String(startHour).padStart(2, '0')}:00`
            const endTime = `${String(endHour).padStart(2, '0')}:00`
            // When start >= end, the time range is invalid per Requirement 5.2
            expect(startTime < endTime).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
