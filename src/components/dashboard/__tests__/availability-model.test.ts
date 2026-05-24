import { describe, expect, it } from 'vitest'
import {
  buildAvailabilitySaveRequest,
  buildDayStates,
  hasAvailabilityChanges,
  normalizeSavedAvailability,
  type AvailabilityOverride,
  type AvailabilityRule,
} from '../availability-model'

const savedRules: AvailabilityRule[] = [
  {
    id: 'rule-monday',
    weekday: 1,
    start_time: '09:00',
    end_time: '17:00',
    is_active: true,
  },
  {
    id: 'rule-tuesday',
    weekday: 2,
    start_time: '10:00',
    end_time: '14:00',
    is_active: true,
  },
]

const savedOverrides: AvailabilityOverride[] = [
  {
    id: 'override-existing',
    date: '2026-06-16',
    start_time: null,
    end_time: null,
    is_available: false,
    reason: 'OOO',
  },
]

describe('availability model helpers', () => {
  it('detects unchanged editor state against the saved baseline', () => {
    expect(
      hasAvailabilityChanges({
        dayStates: buildDayStates(savedRules),
        overrides: savedOverrides,
        savedRules,
        savedOverrides,
      })
    ).toBe(false)
  })

  it('preserves inactive saved rules through unchanged editor state', () => {
    const inactiveRules: AvailabilityRule[] = [
      {
        id: 'rule-inactive-monday',
        weekday: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_active: false,
      },
    ]
    const dayStates = buildDayStates(inactiveRules)

    expect(dayStates.Monday.enabled).toBe(false)
    expect(dayStates.Monday.intervals).toEqual([
      {
        id: 'rule-inactive-monday',
        start: '09:00',
        end: '17:00',
      },
    ])
    expect(
      hasAvailabilityChanges({
        dayStates,
        overrides: [],
        savedRules: inactiveRules,
        savedOverrides: [],
      })
    ).toBe(false)

    const { payload } = buildAvailabilitySaveRequest({
      dayStates,
      overrides: [],
      savedRules: inactiveRules,
      savedOverrides: [],
      selectedScheduleId: 'schedule-1',
      timezone: 'America/New_York',
    })

    expect(payload.rules).toEqual([
      {
        id: 'rule-inactive-monday',
        weekday: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_active: false,
      },
    ])
    expect(payload.deletedRuleIds).toEqual([])
  })

  it('builds a save payload with temp ids stripped and deleted ids preserved', () => {
    const dayStates = buildDayStates(savedRules)
    dayStates.Monday.intervals.push({
      id: 'temp_new_rule',
      start: '18:00',
      end: '19:00',
    })
    dayStates.Tuesday.intervals = []
    const overrides: AvailabilityOverride[] = [
      {
        id: 'temp_new_override',
        date: '2026-06-17',
        start_time: '12:00',
        end_time: '15:00',
        is_available: true,
        reason: null,
      },
    ]

    const { currentRules, payload } = buildAvailabilitySaveRequest({
      dayStates,
      overrides,
      savedRules,
      savedOverrides,
      selectedScheduleId: 'schedule-1',
      timezone: 'America/New_York',
    })

    expect(currentRules).toHaveLength(2)
    expect(payload).toEqual({
      scheduleId: 'schedule-1',
      rules: [
        {
          id: 'rule-monday',
          weekday: 1,
          start_time: '09:00',
          end_time: '17:00',
          is_active: true,
        },
        {
          weekday: 1,
          start_time: '18:00',
          end_time: '19:00',
          is_active: true,
        },
      ],
      overrides: [
        {
          date: '2026-06-17',
          start_time: '12:00',
          end_time: '15:00',
          is_available: true,
          reason: null,
        },
      ],
      deletedRuleIds: ['rule-tuesday'],
      deletedOverrideIds: ['override-existing'],
      timezone: 'America/New_York',
    })
  })

  it('normalizes saved availability rows back to form-friendly time values', () => {
    const normalized = normalizeSavedAvailability({
      savedData: {
        rules: [
          {
            id: 'rule-saved',
            weekday: 1,
            start_time: '09:00:00',
            end_time: '17:30:00',
            is_active: true,
          },
        ],
        overrides: [
          {
            id: 'override-saved',
            date: '2026-06-18',
            start_time: '08:15:00',
            end_time: '10:45:00',
            is_available: true,
            reason: 'Workshop',
          },
        ],
      },
      currentRules: [],
      currentOverrides: [],
      createTempId: () => 'temp-fallback',
    })

    expect(normalized.rules[0]).toMatchObject({
      id: 'rule-saved',
      start_time: '09:00',
      end_time: '17:30',
    })
    expect(normalized.overrides[0]).toMatchObject({
      id: 'override-saved',
      start_time: '08:15',
      end_time: '10:45',
    })
  })
})
