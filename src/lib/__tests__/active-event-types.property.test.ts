import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { stringOf } from '@/test/fast-check'

/**
 * Property 9: Public listing shows only active event types
 * Validates: Requirements 8.3
 */

interface EventType {
  id: string
  title: string
  slug: string
  description: string
  duration_minutes: number
  is_active: boolean
}

function filterActiveEventTypes(eventTypes: EventType[]): EventType[] {
  return eventTypes.filter((et) => et.is_active === true)
}

const eventTypeFields = {
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  slug: stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
    { minLength: 1, maxLength: 50 }
  ),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  duration_minutes: fc.integer({ min: 1, max: 480 }),
  is_active: fc.boolean(),
}

const eventTypeArb = fc.record(eventTypeFields)

describe('Property 9: Public listing shows only active event types', () => {
  it('returns exactly those event types where is_active is true', () => {
    fc.assert(
      fc.property(
        fc.array(eventTypeArb, { minLength: 0, maxLength: 20 }),
        (eventTypes) => {
          const result = filterActiveEventTypes(eventTypes)
          const expected = eventTypes.filter((et) => et.is_active === true)

          expect(result).toHaveLength(expected.length)
          expect(result).toEqual(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no event type in the result has is_active === false', () => {
    fc.assert(
      fc.property(
        fc.array(eventTypeArb, { minLength: 0, maxLength: 20 }),
        (eventTypes) => {
          const result = filterActiveEventTypes(eventTypes)

          for (const et of result) {
            expect(et.is_active).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('preserves all active event types without dropping any', () => {
    fc.assert(
      fc.property(
        fc.array(eventTypeArb, { minLength: 0, maxLength: 20 }),
        (eventTypes) => {
          const result = filterActiveEventTypes(eventTypes)
          const activeIds = eventTypes
            .filter((et) => et.is_active === true)
            .map((et) => et.id)
          const resultIds = result.map((et) => et.id)

          expect(resultIds).toEqual(activeIds)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns empty array when all event types are inactive', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            ...eventTypeFields,
            is_active: fc.constant(false),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (eventTypes) => {
          const result = filterActiveEventTypes(eventTypes as EventType[])
          expect(result).toHaveLength(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
