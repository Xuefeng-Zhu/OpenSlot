import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { saveAvailabilitySchema } from '@/lib/validations/availability'

/**
 * Property 6: Availability save round-trip preserves state
 * Feature: ui-backend-integration, Property 6: Availability save round-trip preserves state
 * Validates: Requirements 5.5, 5.6, 5.7, 5.8
 *
 * For any valid availability state (rules with weekday/start_time/end_time and
 * overrides with date/start_time/end_time/is_available), saving that state via
 * the availability API schema and parsing it back produces an equivalent set
 * of rules and overrides — no data loss during validation/parsing.
 */

// --- Generators ---

/** Generate a valid HH:MM time string */
const timeStringArb = fc
  .record({
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
  })
  .map(({ hour, minute }) => {
    const hh = hour.toString().padStart(2, '0')
    const mm = minute.toString().padStart(2, '0')
    return `${hh}:${mm}`
  })

/** Generate a valid YYYY-MM-DD date string */
const dateStringArb = fc
  .record({
    year: fc.integer({ min: 2024, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid dates
  })
  .map(({ year, month, day }) => {
    const mm = month.toString().padStart(2, '0')
    const dd = day.toString().padStart(2, '0')
    return `${year}-${mm}-${dd}`
  })

/** Generate a valid availability rule */
const ruleArb = fc.record({
  id: fc.option(fc.uuid(), { nil: undefined }),
  weekday: fc.integer({ min: 0, max: 6 }),
  start_time: timeStringArb,
  end_time: timeStringArb,
  is_active: fc.boolean(),
})

/** Generate a valid availability override */
const overrideArb = fc.record({
  id: fc.option(fc.uuid(), { nil: undefined }),
  date: dateStringArb,
  start_time: fc.option(timeStringArb, { nil: null }),
  end_time: fc.option(timeStringArb, { nil: null }),
  is_available: fc.boolean(),
  reason: fc.option(
    fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    { nil: null }
  ),
})

/** Valid IANA timezone arbitrary (only timezones recognized by Intl.supportedValuesOf) */
const timezoneArb = fc.constantFrom(
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland'
)

/** Generate a full valid save availability request body */
const saveAvailabilityRequestArb = fc.record({
  scheduleId: fc.uuid(),
  rules: fc.array(ruleArb, { minLength: 0, maxLength: 7 }),
  overrides: fc.array(overrideArb, { minLength: 0, maxLength: 10 }),
  deletedRuleIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
  deletedOverrideIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
  timezone: timezoneArb,
})

// --- Tests ---

describe('Property 6: Availability save round-trip preserves state', () => {
  it('valid availability data passes schema validation without data loss', () => {
    fc.assert(
      fc.property(saveAvailabilityRequestArb, (input) => {
        const result = saveAvailabilitySchema.safeParse(input)

        // Must parse successfully
        expect(result.success).toBe(true)
        if (!result.success) return

        const parsed = result.data

        // Rules count preserved
        expect(parsed.scheduleId).toBe(input.scheduleId)

        // Rules count preserved
        expect(parsed.rules).toHaveLength(input.rules.length)

        // Each rule's data is preserved
        for (let i = 0; i < input.rules.length; i++) {
          const inputRule = input.rules[i]
          const parsedRule = parsed.rules[i]

          expect(parsedRule.weekday).toBe(inputRule.weekday)
          expect(parsedRule.start_time).toBe(inputRule.start_time)
          expect(parsedRule.end_time).toBe(inputRule.end_time)
          expect(parsedRule.is_active).toBe(inputRule.is_active)

          // ID preserved when present
          if (inputRule.id !== undefined) {
            expect(parsedRule.id).toBe(inputRule.id)
          } else {
            expect(parsedRule.id).toBeUndefined()
          }
        }

        // Overrides count preserved
        expect(parsed.overrides).toHaveLength(input.overrides.length)

        // Each override's data is preserved
        for (let i = 0; i < input.overrides.length; i++) {
          const inputOverride = input.overrides[i]
          const parsedOverride = parsed.overrides[i]

          expect(parsedOverride.date).toBe(inputOverride.date)
          expect(parsedOverride.start_time).toBe(inputOverride.start_time)
          expect(parsedOverride.end_time).toBe(inputOverride.end_time)
          expect(parsedOverride.is_available).toBe(inputOverride.is_available)

          // Reason preserved (null or string)
          if (inputOverride.reason === null || inputOverride.reason === undefined) {
            expect(
              parsedOverride.reason === null || parsedOverride.reason === undefined
            ).toBe(true)
          } else {
            expect(parsedOverride.reason).toBe(inputOverride.reason)
          }

          // ID preserved when present
          if (inputOverride.id !== undefined) {
            expect(parsedOverride.id).toBe(inputOverride.id)
          } else {
            expect(parsedOverride.id).toBeUndefined()
          }
        }

        // Deleted IDs preserved
        expect(parsed.deletedRuleIds).toEqual(input.deletedRuleIds)
        expect(parsed.deletedOverrideIds).toEqual(input.deletedOverrideIds)

        // Timezone preserved
        expect(parsed.timezone).toBe(input.timezone)
      }),
      { numRuns: 100 }
    )
  })

  it('round-trip through JSON serialization and re-parsing preserves all fields', () => {
    fc.assert(
      fc.property(saveAvailabilityRequestArb, (input) => {
        // First parse
        const firstParse = saveAvailabilitySchema.safeParse(input)
        expect(firstParse.success).toBe(true)
        if (!firstParse.success) return

        // Simulate network round-trip: serialize to JSON and parse back
        const serialized = JSON.stringify(firstParse.data)
        const deserialized = JSON.parse(serialized)

        // Second parse (simulating re-fetch and validation)
        const secondParse = saveAvailabilitySchema.safeParse(deserialized)
        expect(secondParse.success).toBe(true)
        if (!secondParse.success) return

        // Both parses should produce equivalent data
        expect(secondParse.data.scheduleId).toBe(firstParse.data.scheduleId)
        expect(secondParse.data.rules).toHaveLength(firstParse.data.rules.length)
        expect(secondParse.data.overrides).toHaveLength(firstParse.data.overrides.length)
        expect(secondParse.data.deletedRuleIds).toEqual(firstParse.data.deletedRuleIds)
        expect(secondParse.data.deletedOverrideIds).toEqual(firstParse.data.deletedOverrideIds)
        expect(secondParse.data.timezone).toBe(firstParse.data.timezone)

        // Deep equality of rules
        for (let i = 0; i < firstParse.data.rules.length; i++) {
          expect(secondParse.data.rules[i].weekday).toBe(firstParse.data.rules[i].weekday)
          expect(secondParse.data.rules[i].start_time).toBe(firstParse.data.rules[i].start_time)
          expect(secondParse.data.rules[i].end_time).toBe(firstParse.data.rules[i].end_time)
          expect(secondParse.data.rules[i].is_active).toBe(firstParse.data.rules[i].is_active)
          expect(secondParse.data.rules[i].id).toBe(firstParse.data.rules[i].id)
        }

        // Deep equality of overrides
        for (let i = 0; i < firstParse.data.overrides.length; i++) {
          expect(secondParse.data.overrides[i].date).toBe(firstParse.data.overrides[i].date)
          expect(secondParse.data.overrides[i].start_time).toBe(firstParse.data.overrides[i].start_time)
          expect(secondParse.data.overrides[i].end_time).toBe(firstParse.data.overrides[i].end_time)
          expect(secondParse.data.overrides[i].is_available).toBe(firstParse.data.overrides[i].is_available)
          expect(secondParse.data.overrides[i].id).toBe(firstParse.data.overrides[i].id)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('rules with all weekday values (0-6) are preserved correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        timeStringArb,
        timeStringArb,
        fc.boolean(),
        (weekday, startTime, endTime, isActive) => {
          const input = {
            rules: [
              {
                weekday,
                start_time: startTime,
                end_time: endTime,
                is_active: isActive,
              },
            ],
            overrides: [],
            deletedRuleIds: [],
            deletedOverrideIds: [],
            scheduleId: '11111111-1111-4111-8111-111111111111',
            timezone: 'America/New_York',
          }

          const result = saveAvailabilitySchema.safeParse(input)
          expect(result.success).toBe(true)
          if (!result.success) return

          expect(result.data.rules[0].weekday).toBe(weekday)
          expect(result.data.rules[0].start_time).toBe(startTime)
          expect(result.data.rules[0].end_time).toBe(endTime)
          expect(result.data.rules[0].is_active).toBe(isActive)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('overrides with nullable time fields preserve null/non-null state', () => {
    fc.assert(
      fc.property(
        dateStringArb,
        fc.option(timeStringArb, { nil: null }),
        fc.option(timeStringArb, { nil: null }),
        fc.boolean(),
        (date, startTime, endTime, isAvailable) => {
          const input = {
            scheduleId: '11111111-1111-4111-8111-111111111111',
            rules: [],
            overrides: [
              {
                date,
                start_time: startTime,
                end_time: endTime,
                is_available: isAvailable,
              },
            ],
            deletedRuleIds: [],
            deletedOverrideIds: [],
            timezone: 'America/New_York',
          }

          const result = saveAvailabilitySchema.safeParse(input)
          expect(result.success).toBe(true)
          if (!result.success) return

          const parsedOverride = result.data.overrides[0]
          expect(parsedOverride.date).toBe(date)
          expect(parsedOverride.start_time).toBe(startTime)
          expect(parsedOverride.end_time).toBe(endTime)
          expect(parsedOverride.is_available).toBe(isAvailable)
        }
      ),
      { numRuns: 100 }
    )
  })
})
