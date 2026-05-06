import { describe, it, expect } from 'vitest'
import { profileSchema } from '../profile'
import { eventTypeSchema } from '../event-type'
import { confirmBookingSchema } from '../booking'
import { availabilityRuleSchema } from '../availability'

describe('profileSchema', () => {
  const validProfile = {
    name: 'John Doe',
    username: 'john-doe',
    default_timezone: 'America/New_York',
  }

  describe('username boundary lengths', () => {
    it('accepts a username with exactly 3 characters (minimum)', () => {
      const result = profileSchema.safeParse({ ...validProfile, username: 'abc' })
      expect(result.success).toBe(true)
    })

    it('rejects a username with 2 characters (below minimum)', () => {
      const result = profileSchema.safeParse({ ...validProfile, username: 'ab' })
      expect(result.success).toBe(false)
    })

    it('accepts a username with exactly 30 characters (maximum)', () => {
      const result = profileSchema.safeParse({ ...validProfile, username: 'a'.repeat(30) })
      expect(result.success).toBe(true)
    })

    it('rejects a username with 31 characters (above maximum)', () => {
      const result = profileSchema.safeParse({ ...validProfile, username: 'a'.repeat(31) })
      expect(result.success).toBe(false)
    })
  })

  describe('name boundary lengths', () => {
    it('accepts a name with exactly 1 character (minimum)', () => {
      const result = profileSchema.safeParse({ ...validProfile, name: 'A' })
      expect(result.success).toBe(true)
    })

    it('rejects an empty name', () => {
      const result = profileSchema.safeParse({ ...validProfile, name: '' })
      expect(result.success).toBe(false)
    })

    it('accepts a name with exactly 100 characters (maximum)', () => {
      const result = profileSchema.safeParse({ ...validProfile, name: 'A'.repeat(100) })
      expect(result.success).toBe(true)
    })

    it('rejects a name with 101 characters (above maximum)', () => {
      const result = profileSchema.safeParse({ ...validProfile, name: 'A'.repeat(101) })
      expect(result.success).toBe(false)
    })
  })
})

describe('eventTypeSchema', () => {
  const validEventType = {
    title: 'Meeting',
    duration_minutes: 30,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    min_notice_minutes: 60,
    max_booking_days_ahead: 60,
    location_type: 'online' as const,
    is_active: true,
  }

  describe('duration_minutes boundary values', () => {
    it('rejects duration of 0 (must be positive)', () => {
      const result = eventTypeSchema.safeParse({ ...validEventType, duration_minutes: 0 })
      expect(result.success).toBe(false)
    })

    it('accepts duration of 1 (minimum positive integer)', () => {
      const result = eventTypeSchema.safeParse({ ...validEventType, duration_minutes: 1 })
      expect(result.success).toBe(true)
    })

    it('rejects negative duration', () => {
      const result = eventTypeSchema.safeParse({ ...validEventType, duration_minutes: -1 })
      expect(result.success).toBe(false)
    })
  })

  describe('buffer boundary values', () => {
    it('rejects negative buffer_before_minutes', () => {
      const result = eventTypeSchema.safeParse({ ...validEventType, buffer_before_minutes: -1 })
      expect(result.success).toBe(false)
    })

    it('accepts buffer_before_minutes of 0', () => {
      const result = eventTypeSchema.safeParse({ ...validEventType, buffer_before_minutes: 0 })
      expect(result.success).toBe(true)
    })

    it('rejects negative buffer_after_minutes', () => {
      const result = eventTypeSchema.safeParse({ ...validEventType, buffer_after_minutes: -1 })
      expect(result.success).toBe(false)
    })

    it('accepts buffer_after_minutes of 0', () => {
      const result = eventTypeSchema.safeParse({ ...validEventType, buffer_after_minutes: 0 })
      expect(result.success).toBe(true)
    })
  })
})

describe('confirmBookingSchema', () => {
  const validBooking = {
    holdToken: '550e8400-e29b-41d4-a716-446655440000',
    guestName: 'Jane Doe',
    guestEmail: 'jane@example.com',
    guestTimezone: 'America/New_York',
  }

  describe('holdToken validation', () => {
    it('accepts a valid UUID holdToken', () => {
      const result = confirmBookingSchema.safeParse(validBooking)
      expect(result.success).toBe(true)
    })

    it('rejects an empty holdToken', () => {
      const result = confirmBookingSchema.safeParse({ ...validBooking, holdToken: '' })
      expect(result.success).toBe(false)
    })

    it('rejects a non-UUID holdToken', () => {
      const result = confirmBookingSchema.safeParse({ ...validBooking, holdToken: 'not-a-uuid' })
      expect(result.success).toBe(false)
    })
  })

  describe('guestName validation', () => {
    it('rejects an empty guestName', () => {
      const result = confirmBookingSchema.safeParse({ ...validBooking, guestName: '' })
      expect(result.success).toBe(false)
    })

    it('accepts a single character guestName', () => {
      const result = confirmBookingSchema.safeParse({ ...validBooking, guestName: 'A' })
      expect(result.success).toBe(true)
    })

    it('accepts a guestName with exactly 100 characters', () => {
      const result = confirmBookingSchema.safeParse({ ...validBooking, guestName: 'A'.repeat(100) })
      expect(result.success).toBe(true)
    })

    it('rejects a guestName with 101 characters', () => {
      const result = confirmBookingSchema.safeParse({ ...validBooking, guestName: 'A'.repeat(101) })
      expect(result.success).toBe(false)
    })
  })
})

describe('availabilityRuleSchema', () => {
  const validRule = {
    weekday: 1,
    start_time: '09:00',
    end_time: '17:00',
    timezone: 'America/New_York',
    is_active: true,
  }

  describe('time range validation', () => {
    it('rejects when start_time equals end_time', () => {
      const result = availabilityRuleSchema.safeParse({ ...validRule, start_time: '09:00', end_time: '09:00' })
      expect(result.success).toBe(false)
    })

    it('rejects when start_time is after end_time', () => {
      const result = availabilityRuleSchema.safeParse({ ...validRule, start_time: '17:00', end_time: '09:00' })
      expect(result.success).toBe(false)
    })

    it('accepts a valid time range where start_time is before end_time', () => {
      const result = availabilityRuleSchema.safeParse(validRule)
      expect(result.success).toBe(true)
    })

    it('accepts adjacent times (start just before end)', () => {
      const result = availabilityRuleSchema.safeParse({ ...validRule, start_time: '08:59', end_time: '09:00' })
      expect(result.success).toBe(true)
    })
  })

  describe('weekday boundary values', () => {
    it('accepts weekday 0 (Sunday)', () => {
      const result = availabilityRuleSchema.safeParse({ ...validRule, weekday: 0 })
      expect(result.success).toBe(true)
    })

    it('accepts weekday 6 (Saturday)', () => {
      const result = availabilityRuleSchema.safeParse({ ...validRule, weekday: 6 })
      expect(result.success).toBe(true)
    })

    it('rejects weekday -1 (below range)', () => {
      const result = availabilityRuleSchema.safeParse({ ...validRule, weekday: -1 })
      expect(result.success).toBe(false)
    })

    it('rejects weekday 7 (above range)', () => {
      const result = availabilityRuleSchema.safeParse({ ...validRule, weekday: 7 })
      expect(result.success).toBe(false)
    })
  })
})
