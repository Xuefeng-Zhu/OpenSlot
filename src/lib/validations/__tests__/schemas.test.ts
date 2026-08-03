import { describe, it, expect } from 'vitest'
import { profileSchema } from '../profile'
import { eventTypeSchema } from '../event-type'
import { confirmBookingSchema, createConfirmBookingFormSchema } from '../booking'
import { availabilityRuleSchema, saveAvailabilitySchema } from '../availability'

describe('profileSchema', () => {
  const validProfile = {
    name: 'John Doe',
    username: 'john-doe',
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

  describe('public metadata boundary lengths', () => {
    it('accepts optional public profile metadata at maximum length', () => {
      const result = profileSchema.safeParse({
        ...validProfile,
        public_headline: 'A'.repeat(80),
        public_bio: 'B'.repeat(280),
        response_time_label: 'C'.repeat(80),
      })

      expect(result.success).toBe(true)
    })

    it('rejects optional public profile metadata above maximum length', () => {
      const result = profileSchema.safeParse({
        ...validProfile,
        public_headline: 'A'.repeat(81),
        public_bio: 'B'.repeat(281),
        response_time_label: 'C'.repeat(81),
      })

      expect(result.success).toBe(false)
    })
  })
})

describe('eventTypeSchema', () => {
  const validEventType = {
    schedule_id: '11111111-1111-4111-8111-111111111111',
    title: 'Meeting',
    slug: 'meeting',
    duration_minutes: 30,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    min_notice_minutes: 60,
    max_booking_days_ahead: 60,
    location_type: 'online' as const,
    location_value: 'https://meet.example.com/demo',
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

  describe('slug validation', () => {
    it('accepts lowercase URL-safe slugs', () => {
      const result = eventTypeSchema.safeParse({ ...validEventType, slug: 'intro-call-30' })
      expect(result.success).toBe(true)
    })

    it('rejects slugs with uppercase letters or spaces', () => {
      const result = eventTypeSchema.safeParse({ ...validEventType, slug: 'Intro Call' })
      expect(result.success).toBe(false)
    })
  })

  describe('location validation', () => {
    it('accepts generated Google Meet locations with a provider', () => {
      const result = eventTypeSchema.safeParse({
        ...validEventType,
        location_type: 'video_provider',
        video_provider: 'google_meet',
      })

      expect(result.success).toBe(true)
    })

    it('rejects generated video locations without a provider', () => {
      const result = eventTypeSchema.safeParse({
        ...validEventType,
        location_type: 'video_provider',
      })

      expect(result.success).toBe(false)
    })

    it('requires details for manual locations', () => {
      for (const locationType of ['online', 'custom', 'phone', 'in_person'] as const) {
        const result = eventTypeSchema.safeParse({
          ...validEventType,
          location_type: locationType,
          location_value: '',
        })

        expect(result.success).toBe(false)
      }
    })
  })

  describe('invitee questions', () => {
    it('accepts required and optional custom questions', () => {
      const result = eventTypeSchema.safeParse({
        ...validEventType,
        invitee_questions: [
          {
            id: 'topic',
            label: 'What should we discuss?',
            type: 'textarea',
            required: true,
            options: [],
          },
          {
            id: 'priority',
            label: 'Priority',
            type: 'select',
            required: false,
            options: ['High', 'Low'],
          },
        ],
      })

      expect(result.success).toBe(true)
    })

    it('rejects select questions without at least two options', () => {
      const result = eventTypeSchema.safeParse({
        ...validEventType,
        invitee_questions: [
          {
            id: 'priority',
            label: 'Priority',
            type: 'select',
            required: true,
            options: ['High'],
          },
        ],
      })

      expect(result.success).toBe(false)
    })
  })

  describe('reminder policy validation', () => {
    it('requires a recipient for generated video event reminders', () => {
      const result = eventTypeSchema.safeParse({
        ...validEventType,
        location_type: 'video_provider',
        video_provider: 'google_meet',
        reminder_enabled: true,
        reminder_guest_enabled: false,
        reminder_host_enabled: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.reminder_guest_enabled).toEqual([
          'Select at least one reminder recipient',
        ])
      }
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

  describe('invitee answer validation', () => {
    it('requires answers for required custom questions', () => {
      const schema = createConfirmBookingFormSchema([
        {
          id: 'topic',
          label: 'What should we discuss?',
          type: 'textarea',
          required: true,
          options: [],
        },
      ])

      const result = schema.safeParse({
        guestName: 'Jane Doe',
        guestEmail: 'jane@example.com',
        guestTimezone: 'America/New_York',
        answers: { topic: '' },
      })

      expect(result.success).toBe(false)
    })

    it('accepts typed custom answers when configured', () => {
      const schema = createConfirmBookingFormSchema([
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          required: true,
          options: ['High', 'Low'],
        },
        {
          id: 'send-summary',
          label: 'Send a summary afterward',
          type: 'checkbox',
          required: false,
          options: [],
        },
      ])

      const result = schema.safeParse({
        guestName: 'Jane Doe',
        guestEmail: 'jane@example.com',
        guestTimezone: 'America/New_York',
        answers: {
          priority: 'High',
          'send-summary': true,
        },
      })

      expect(result.success).toBe(true)
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

    it('rejects equal ranges with mixed time precision', () => {
      const result = availabilityRuleSchema.safeParse({ ...validRule, start_time: '09:00', end_time: '09:00:00' })
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

describe('saveAvailabilitySchema', () => {
  const validSaveBody = {
    scheduleId: '11111111-1111-4111-8111-111111111111',
    expectedScheduleUpdatedAt: '2026-08-03T08:00:00.000Z',
    rules: [
      {
        weekday: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_active: true,
      },
    ],
    overrides: [
      {
        date: '2026-06-17',
        start_time: '10:00',
        end_time: '12:00',
        is_available: true,
      },
    ],
    deletedRuleIds: [],
    deletedOverrideIds: [],
    timezone: 'America/New_York',
  }

  it('rejects saved weekly rules when start_time equals end_time', () => {
    const result = saveAvailabilitySchema.safeParse({
      ...validSaveBody,
      rules: [
        {
          weekday: 1,
          start_time: '09:00',
          end_time: '09:00',
          is_active: true,
        },
      ],
    })

    expect(result.success).toBe(false)
  })

  it('rejects saved weekly rules with equal mixed-precision times', () => {
    const result = saveAvailabilitySchema.safeParse({
      ...validSaveBody,
      rules: [
        {
          weekday: 1,
          start_time: '09:00',
          end_time: '09:00:00',
          is_active: true,
        },
      ],
    })

    expect(result.success).toBe(false)
  })

  it('rejects saved weekly rules when start_time is after end_time', () => {
    const result = saveAvailabilitySchema.safeParse({
      ...validSaveBody,
      rules: [
        {
          weekday: 1,
          start_time: '17:00',
          end_time: '09:00',
          is_active: true,
        },
      ],
    })

    expect(result.success).toBe(false)
  })

  it('rejects available date overrides without a complete time range', () => {
    const result = saveAvailabilitySchema.safeParse({
      ...validSaveBody,
      overrides: [
        {
          date: '2026-06-17',
          start_time: null,
          end_time: null,
          is_available: true,
        },
      ],
    })

    expect(result.success).toBe(false)
  })

  it('rejects available date overrides when start_time is not before end_time', () => {
    const result = saveAvailabilitySchema.safeParse({
      ...validSaveBody,
      overrides: [
        {
          date: '2026-06-17',
          start_time: '12:00',
          end_time: '10:00',
          is_available: true,
        },
      ],
    })

    expect(result.success).toBe(false)
  })

  it('rejects available date overrides with equal mixed-precision times', () => {
    const result = saveAvailabilitySchema.safeParse({
      ...validSaveBody,
      overrides: [
        {
          date: '2026-06-17',
          start_time: '09:00',
          end_time: '09:00:00',
          is_available: true,
        },
      ],
    })

    expect(result.success).toBe(false)
  })

  it.each(['24:00', '29:00', '12:60', '12:30:60'])(
    'rejects impossible clock time %s',
    (endTime) => {
      const result = saveAvailabilitySchema.safeParse({
        ...validSaveBody,
        rules: [{ ...validSaveBody.rules[0], end_time: endTime }],
      })

      expect(result.success).toBe(false)
    }
  )

  it.each(['2026-02-30', '2026-13-01', '2026-00-01'])(
    'rejects impossible calendar date %s',
    (date) => {
      const result = saveAvailabilitySchema.safeParse({
        ...validSaveBody,
        overrides: [{ ...validSaveBody.overrides[0], date }],
      })

      expect(result.success).toBe(false)
    }
  )

  it('rejects an invalid expected schedule version', () => {
    const result = saveAvailabilitySchema.safeParse({
      ...validSaveBody,
      expectedScheduleUpdatedAt: 'not-a-timestamp',
    })

    expect(result.success).toBe(false)
  })
})
