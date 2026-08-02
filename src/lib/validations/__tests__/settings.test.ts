import { describe, expect, it } from 'vitest'
import {
  isLegacyFullSettingsPayload,
  settingsPatchSchema,
} from '../settings'

describe('settingsPatchSchema', () => {
  it.each([
    {
      section: 'account',
      email: 'Host@Example.com',
    },
    {
      section: 'preferences',
      defaultTimezone: 'America/Los_Angeles',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h',
    },
    {
      section: 'notifications',
      notifyNewBooking: true,
      notifyCancellation: false,
      notifyReminder: true,
    },
  ])('accepts a valid $section payload', (payload) => {
    expect(settingsPatchSchema.safeParse(payload).success).toBe(true)
  })

  it('normalizes account emails', () => {
    const result = settingsPatchSchema.safeParse({
      section: 'account',
      email: ' Host@Example.com ',
    })

    expect(result.success).toBe(true)
    if (result.success && result.data.section === 'account') {
      expect(result.data.email).toBe('host@example.com')
    }
  })

  it('rejects cross-section fields', () => {
    const result = settingsPatchSchema.safeParse({
      section: 'notifications',
      notifyNewBooking: true,
      notifyCancellation: true,
      notifyReminder: true,
      email: 'hidden-draft@example.com',
    })

    expect(result.success).toBe(false)
  })
})

describe('isLegacyFullSettingsPayload', () => {
  it('recognizes the retired all-sections shape', () => {
    expect(
      isLegacyFullSettingsPayload({
        name: 'Host',
        email: 'host@example.com',
        defaultTimezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        notifyNewBooking: true,
        notifyCancellation: true,
        notifyReminder: true,
      })
    ).toBe(true)
  })

  it('does not classify a section payload as legacy', () => {
    expect(
      isLegacyFullSettingsPayload({
        section: 'account',
        email: 'host@example.com',
      })
    ).toBe(false)
  })
})
