import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  browserTimezoneOrDefault,
  DEFAULT_TIMEZONE,
  fromHostTimezone,
  getTimezones,
  getWeekdayInTimezone,
  timezoneOptionsWithCurrent,
  toHostTimezone,
  validTimezoneOrNull,
} from '../timezone'

describe('timezone utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validTimezoneOrNull', () => {
    it('returns a trimmed valid timezone', () => {
      expect(validTimezoneOrNull(' America/New_York ')).toBe(
        'America/New_York'
      )
    })

    it('returns null for blank or invalid timezones', () => {
      expect(validTimezoneOrNull('')).toBeNull()
      expect(validTimezoneOrNull('Not/A_Timezone')).toBeNull()
    })
  })

  describe('browserTimezoneOrDefault', () => {
    it('falls back when browser timezone detection fails', () => {
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
        throw new Error('timezone unavailable')
      })

      expect(browserTimezoneOrDefault('America/Chicago')).toBe(
        'America/Chicago'
      )
    })
  })

  describe('getTimezones', () => {
    it('keeps UTC in the fallback timezone list', () => {
      vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => {
        throw new Error('supportedValuesOf unavailable')
      })

      expect(getTimezones()).toContain(DEFAULT_TIMEZONE)
    })
  })

  describe('timezoneOptionsWithCurrent', () => {
    it('prepends a valid current timezone once', () => {
      const options = timezoneOptionsWithCurrent('UTC', 'America/New_York')

      expect(options[0]).toBe(DEFAULT_TIMEZONE)
      expect(
        options.filter((timezone) => timezone === 'America/New_York')
      ).toHaveLength(1)
    })

    it('drops invalid current timezone values', () => {
      expect(timezoneOptionsWithCurrent('Not/A_Timezone')).not.toContain(
        'Not/A_Timezone'
      )
    })
  })

  describe('toHostTimezone', () => {
    it('converts UTC to Eastern time', () => {
      // 2025-01-06 15:00 UTC = 2025-01-06 10:00 ET (EST, UTC-5)
      const utcDate = new Date('2025-01-06T15:00:00Z')
      const local = toHostTimezone(utcDate, 'America/New_York')
      expect(local.getHours()).toBe(10)
      expect(local.getMinutes()).toBe(0)
    })

    it('converts UTC to Pacific time', () => {
      // 2025-01-06 15:00 UTC = 2025-01-06 07:00 PT (PST, UTC-8)
      const utcDate = new Date('2025-01-06T15:00:00Z')
      const local = toHostTimezone(utcDate, 'America/Los_Angeles')
      expect(local.getHours()).toBe(7)
      expect(local.getMinutes()).toBe(0)
    })
  })

  describe('fromHostTimezone', () => {
    it('converts Eastern time to UTC', () => {
      // 2025-01-06 10:00 ET = 2025-01-06 15:00 UTC (EST, UTC-5)
      const localDate = new Date('2025-01-06T10:00:00')
      const utc = fromHostTimezone(localDate, 'America/New_York')
      expect(utc.toISOString()).toBe('2025-01-06T15:00:00.000Z')
    })

    it('converts Pacific time to UTC', () => {
      // 2025-01-06 07:00 PT = 2025-01-06 15:00 UTC (PST, UTC-8)
      const localDate = new Date('2025-01-06T07:00:00')
      const utc = fromHostTimezone(localDate, 'America/Los_Angeles')
      expect(utc.toISOString()).toBe('2025-01-06T15:00:00.000Z')
    })
  })

  describe('getWeekdayInTimezone', () => {
    it('returns correct weekday for a Monday', () => {
      // 2025-01-06 is a Monday
      const weekday = getWeekdayInTimezone('2025-01-06', 'America/New_York')
      expect(weekday).toBe(1) // Monday
    })

    it('returns correct weekday for a Sunday', () => {
      // 2025-01-05 is a Sunday
      const weekday = getWeekdayInTimezone('2025-01-05', 'America/New_York')
      expect(weekday).toBe(0) // Sunday
    })

    it('returns correct weekday for a Saturday', () => {
      // 2025-01-04 is a Saturday
      const weekday = getWeekdayInTimezone('2025-01-04', 'America/New_York')
      expect(weekday).toBe(6) // Saturday
    })

    it('handles different timezones correctly', () => {
      // 2025-01-06 is Monday in all timezones when using noon
      const weekdayNY = getWeekdayInTimezone('2025-01-06', 'America/New_York')
      const weekdayTokyo = getWeekdayInTimezone('2025-01-06', 'Asia/Tokyo')
      const weekdayLondon = getWeekdayInTimezone('2025-01-06', 'Europe/London')

      expect(weekdayNY).toBe(1)
      expect(weekdayTokyo).toBe(1)
      expect(weekdayLondon).toBe(1)
    })
  })

  describe('round-trip conversion', () => {
    it('preserves the instant when converting UTC → local → UTC', () => {
      const original = new Date('2025-06-15T18:30:00Z')
      const timezone = 'America/Chicago'

      const local = toHostTimezone(original, timezone)
      const backToUtc = fromHostTimezone(local, timezone)

      expect(backToUtc.getTime()).toBe(original.getTime())
    })

    it('preserves the instant across DST boundary', () => {
      // March 9, 2025 is DST transition day in US
      const original = new Date('2025-03-09T08:00:00Z')
      const timezone = 'America/New_York'

      const local = toHostTimezone(original, timezone)
      const backToUtc = fromHostTimezone(local, timezone)

      expect(backToUtc.getTime()).toBe(original.getTime())
    })
  })
})
