import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeAvailableSlots } from '../compute-slots'
import type {
  AvailabilityRule,
  AvailabilityOverride,
  TimeSlot,
  ComputeSlotsInput,
} from '../types'

// Helper to create a rule for a specific weekday
function makeRule(overrides: Partial<AvailabilityRule> = {}): AvailabilityRule {
  return {
    id: 'rule-1',
    user_id: 'user-1',
    weekday: 1, // Monday
    start_time: '09:00',
    end_time: '17:00',
    timezone: 'America/New_York',
    is_active: true,
    ...overrides,
  }
}

// Helper to create a standard input
function makeInput(overrides: Partial<ComputeSlotsInput> = {}): ComputeSlotsInput {
  return {
    date: '2025-01-06', // Monday
    hostUserId: 'user-1',
    eventTypeId: 'event-1',
    guestTimezone: 'America/New_York',
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minNoticeMinutes: 0,
    maxBookingDaysAhead: 60,
    ...overrides,
  }
}

describe('computeAvailableSlots', () => {
  beforeEach(() => {
    // Fix "now" to 2025-01-06 00:00:00 UTC (well before the test slots)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-06T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns slots within availability window', () => {
    const rules = [makeRule({ start_time: '09:00', end_time: '10:00' })]
    const input = makeInput({ durationMinutes: 30 })

    const slots = computeAvailableSlots(input, rules, [], [], [])

    // 09:00-10:00 with 30min slots = 2 slots: 09:00-09:30, 09:30-10:00
    expect(slots).toHaveLength(2)
  })

  it('accepts database TIME values that include seconds', () => {
    const rules = [
      makeRule({ start_time: '09:00:00', end_time: '10:00:00.000000' }),
    ]

    const slots = computeAvailableSlots(makeInput(), rules, [], [], [])

    expect(slots.map((slot) => slot.start)).toEqual([
      '2025-01-06T14:00:00.000Z',
      '2025-01-06T14:30:00.000Z',
    ])
  })

  it('returns empty array when no rules match the weekday', () => {
    // Rule is for Tuesday (weekday 2), but date is Monday
    const rules = [makeRule({ weekday: 2 })]
    const input = makeInput()

    const slots = computeAvailableSlots(input, rules, [], [], [])

    expect(slots).toHaveLength(0)
  })

  it('returns empty array when override marks day unavailable', () => {
    const rules = [makeRule()]
    const override: AvailabilityOverride = {
      id: 'override-1',
      user_id: 'user-1',
      date: '2025-01-06',
      start_time: null,
      end_time: null,
      timezone: 'America/New_York',
      is_available: false,
      reason: 'Holiday',
    }
    const input = makeInput()

    const slots = computeAvailableSlots(input, rules, [override], [], [])

    expect(slots).toHaveLength(0)
  })

  it('uses override hours instead of weekly rules', () => {
    const rules = [makeRule({ start_time: '09:00', end_time: '17:00' })]
    const override: AvailabilityOverride = {
      id: 'override-1',
      user_id: 'user-1',
      date: '2025-01-06',
      start_time: '10:00',
      end_time: '11:00',
      timezone: 'America/New_York',
      is_available: true,
      reason: null,
    }
    const input = makeInput({ durationMinutes: 30 })

    const slots = computeAvailableSlots(input, rules, [override], [], [])

    // Override: 10:00-11:00 with 30min slots = 2 slots
    expect(slots).toHaveLength(2)
  })

  it('excludes slots that conflict with existing bookings', () => {
    const rules = [makeRule({ start_time: '09:00', end_time: '10:00' })]
    const input = makeInput({ durationMinutes: 30 })

    // Block the first slot (09:00-09:30 in America/New_York = 14:00-14:30 UTC)
    const booking: TimeSlot = {
      start: '2025-01-06T14:00:00.000Z',
      end: '2025-01-06T14:30:00.000Z',
    }

    const slots = computeAvailableSlots(input, rules, [], [booking], [])

    // Only the second slot (09:30-10:00) should remain
    expect(slots).toHaveLength(1)
    expect(slots[0].start).toBe('2025-01-06T14:30:00.000Z')
  })

  it('excludes slots that conflict with active holds', () => {
    const rules = [makeRule({ start_time: '09:00', end_time: '10:00' })]
    const input = makeInput({ durationMinutes: 30 })

    const hold: TimeSlot = {
      start: '2025-01-06T14:00:00.000Z',
      end: '2025-01-06T14:30:00.000Z',
    }

    const slots = computeAvailableSlots(input, rules, [], [], [hold])

    expect(slots).toHaveLength(1)
    expect(slots[0].start).toBe('2025-01-06T14:30:00.000Z')
  })

  it('excludes slots that conflict with synced external calendar busy windows', () => {
    const rules = [makeRule({ start_time: '09:00', end_time: '10:00' })]
    const input = makeInput({ durationMinutes: 30 })

    const externalBusy: TimeSlot = {
      start: '2025-01-06T14:30:00.000Z',
      end: '2025-01-06T15:00:00.000Z',
    }

    const slots = computeAvailableSlots(
      input,
      rules,
      [],
      [],
      [],
      [externalBusy]
    )

    expect(slots).toHaveLength(1)
    expect(slots[0].start).toBe('2025-01-06T14:00:00.000Z')
  })

  it('accounts for buffer_before when checking conflicts', () => {
    const rules = [makeRule({ start_time: '09:00', end_time: '11:00' })]
    const input = makeInput({
      durationMinutes: 30,
      bufferBeforeMinutes: 15,
    })

    // Booking at 09:30-10:00 ET (14:30-15:00 UTC)
    // With 15min buffer before, the 09:15-09:45 slot's blocked range starts at 09:00
    // The 09:30-10:00 slot's blocked range starts at 09:15, which overlaps the booking
    const booking: TimeSlot = {
      start: '2025-01-06T14:30:00.000Z',
      end: '2025-01-06T15:00:00.000Z',
    }

    const slots = computeAvailableSlots(input, rules, [], [booking], [])

    // The slot at 09:30 (14:30 UTC) should be excluded because its blocked range
    // [09:15, 10:00] overlaps with booking [09:30, 10:00]
    // The slot at 09:00 (14:00 UTC) should also be excluded because its blocked range
    // [08:45, 09:30] overlaps with booking [09:30, 10:00]? No - [08:45, 09:30] vs [09:30, 10:00]
    // Actually [08:45, 09:30) does NOT overlap [09:30, 10:00) since they share only the boundary
    // But our overlap check uses isBefore(startA, endB) && isBefore(startB, endA)
    // startA=08:45 < endB=10:00 ✓, startB=09:30 < endA=09:30 ✗ → no overlap. Correct!

    // Slot 09:00-09:30: blocked range [08:45, 09:30] vs booking [09:30, 10:00]
    //   08:45 < 10:00 ✓, 09:30 < 09:30 ✗ → no conflict ✓
    // Slot 09:30-10:00: blocked range [09:15, 10:00] vs booking [09:30, 10:00]
    //   09:15 < 10:00 ✓, 09:30 < 10:00 ✓ → conflict! ✓
    // Slot 10:00-10:30: blocked range [09:45, 10:30] vs booking [09:30, 10:00]
    //   09:45 < 10:00 ✓, 09:30 < 10:30 ✓ → conflict! ✓
    // Slot 10:30-11:00: blocked range [10:15, 11:00] vs booking [09:30, 10:00]
    //   10:15 < 10:00 ✗ → no conflict ✓

    const slotStarts = slots.map((s) => s.start)
    expect(slotStarts).toContain('2025-01-06T14:00:00.000Z') // 09:00 ET
    expect(slotStarts).not.toContain('2025-01-06T14:30:00.000Z') // 09:30 ET blocked
    expect(slotStarts).not.toContain('2025-01-06T15:00:00.000Z') // 10:00 ET blocked
    expect(slotStarts).toContain('2025-01-06T15:30:00.000Z') // 10:30 ET ok
  })

  it('accounts for buffer_after when checking conflicts', () => {
    const rules = [makeRule({ start_time: '09:00', end_time: '11:00' })]
    const input = makeInput({
      durationMinutes: 30,
      bufferAfterMinutes: 15,
    })

    // Booking at 10:00-10:30 ET (15:00-15:30 UTC)
    const booking: TimeSlot = {
      start: '2025-01-06T15:00:00.000Z',
      end: '2025-01-06T15:30:00.000Z',
    }

    const slots = computeAvailableSlots(input, rules, [], [booking], [])

    // Slot 09:30-10:00: blocked range [09:30, 10:15] vs booking [10:00, 10:30]
    //   09:30 < 10:30 ✓, 10:00 < 10:15 ✓ → conflict!
    // Slot 10:00-10:30: blocked range [10:00, 10:45] vs booking [10:00, 10:30]
    //   10:00 < 10:30 ✓, 10:00 < 10:45 ✓ → conflict!
    // Slot 10:30-11:00: blocked range [10:30, 11:15] vs booking [10:00, 10:30]
    //   10:30 < 10:30 ✗ → no conflict

    const slotStarts = slots.map((s) => s.start)
    expect(slotStarts).toContain('2025-01-06T14:00:00.000Z') // 09:00 ET ok
    expect(slotStarts).not.toContain('2025-01-06T14:30:00.000Z') // 09:30 ET blocked
    expect(slotStarts).not.toContain('2025-01-06T15:00:00.000Z') // 10:00 ET blocked
    expect(slotStarts).toContain('2025-01-06T15:30:00.000Z') // 10:30 ET ok
  })

  it('excludes slots within min_notice_minutes', () => {
    // Set "now" to 09:30 ET on the test date
    vi.setSystemTime(new Date('2025-01-06T14:30:00Z'))

    const rules = [makeRule({ start_time: '09:00', end_time: '11:00' })]
    const input = makeInput({
      durationMinutes: 30,
      minNoticeMinutes: 60, // 1 hour notice required
    })

    const slots = computeAvailableSlots(input, rules, [], [], [])

    // Now is 09:30 ET, earliest start = 10:30 ET
    // Slots before 10:30 should be excluded
    const slotStarts = slots.map((s) => s.start)
    expect(slotStarts).not.toContain('2025-01-06T14:00:00.000Z') // 09:00 ET
    expect(slotStarts).not.toContain('2025-01-06T14:30:00.000Z') // 09:30 ET
    expect(slotStarts).not.toContain('2025-01-06T15:00:00.000Z') // 10:00 ET
    expect(slotStarts).toContain('2025-01-06T15:30:00.000Z') // 10:30 ET ✓
  })

  it('excludes slots beyond max_booking_days_ahead', () => {
    // Set "now" to Jan 1, 2025
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))

    const rules = [makeRule({ weekday: 1 })] // Monday
    const input = makeInput({
      date: '2025-03-10', // Monday, 68 days ahead
      maxBookingDaysAhead: 60,
    })

    const slots = computeAvailableSlots(input, rules, [], [], [])

    // All slots should be excluded since the date is beyond 60 days
    expect(slots).toHaveLength(0)
  })

  it('returns slots for a date within max_booking_days_ahead', () => {
    // Set "now" to Jan 1, 2025
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))

    const rules = [makeRule({ weekday: 1 })] // Monday
    const input = makeInput({
      date: '2025-01-06', // Monday, 5 days ahead
      maxBookingDaysAhead: 60,
    })

    const slots = computeAvailableSlots(input, rules, [], [], [])

    expect(slots.length).toBeGreaterThan(0)
  })

  it('handles multiple availability windows on the same day', () => {
    const rules = [
      makeRule({ start_time: '09:00', end_time: '12:00' }),
      makeRule({ start_time: '14:00', end_time: '17:00' }),
    ]
    const input = makeInput({ durationMinutes: 60 })

    const slots = computeAvailableSlots(input, rules, [], [], [])

    // 09:00-12:00 = 3 one-hour slots, 14:00-17:00 = 3 one-hour slots
    expect(slots).toHaveLength(6)
  })

  it('returns empty when rules are inactive', () => {
    const rules = [makeRule({ is_active: false })]
    const input = makeInput()

    const slots = computeAvailableSlots(input, rules, [], [], [])

    expect(slots).toHaveLength(0)
  })

  it('handles empty rules array gracefully', () => {
    const input = makeInput()

    const slots = computeAvailableSlots(input, [], [], [], [])

    expect(slots).toHaveLength(0)
  })
})
