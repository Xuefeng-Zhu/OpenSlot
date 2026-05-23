/**
 * Timezone conversion utilities using date-fns-tz.
 *
 * These helpers wrap date-fns-tz functions to provide a clear API
 * for converting between UTC and host/guest timezones, and for
 * determining the weekday in a specific timezone.
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export const DEFAULT_TIMEZONE = 'UTC'

export const COMMON_TIMEZONES = [
  DEFAULT_TIMEZONE,
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'America/Sao_Paulo',
  'Africa/Cairo',
  'Africa/Johannesburg',
]

/**
 * Checks if a timezone string is a valid IANA timezone identifier.
 */
export function isValidTimezone(timezone: string): boolean {
  if (timezone === DEFAULT_TIMEZONE) {
    return true
  }

  try {
    const validTimezones = Intl.supportedValuesOf('timeZone')
    return validTimezones.includes(timezone)
  } catch {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone })
      return true
    } catch {
      return false
    }
  }
}

/**
 * Returns a list of all valid IANA timezone identifiers.
 */
export function getTimezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return COMMON_TIMEZONES
  }
}

export function validTimezoneOrNull(
  value: string | null | undefined
): string | null {
  const timezone = value?.trim()
  return timezone && isValidTimezone(timezone) ? timezone : null
}

export function browserTimezoneOrDefault(
  defaultTimezone = DEFAULT_TIMEZONE
): string {
  try {
    return (
      validTimezoneOrNull(Intl.DateTimeFormat().resolvedOptions().timeZone) ??
      defaultTimezone
    )
  } catch {
    return defaultTimezone
  }
}

export function timezoneOptionsWithCurrent(
  ...timezones: Array<string | null | undefined>
): string[] {
  return Array.from(
    new Set([
      ...timezones.filter((timezone): timezone is string => Boolean(timezone)),
      ...COMMON_TIMEZONES,
    ])
  ).filter(isValidTimezone)
}

/**
 * Convert a UTC Date to the equivalent local time in the given timezone.
 * The returned Date object represents the "wall clock" time in that timezone.
 */
export function toHostTimezone(utcDate: Date, timezone: string): Date {
  return toZonedTime(utcDate, timezone)
}

/**
 * Convert a local Date (representing wall clock time in the given timezone)
 * back to a UTC Date.
 */
export function fromHostTimezone(localDate: Date, timezone: string): Date {
  return fromZonedTime(localDate, timezone)
}

/**
 * Determine the weekday (0 = Sunday, 6 = Saturday) for a given date string
 * ("YYYY-MM-DD") when interpreted in the specified timezone.
 *
 * This is important because a date like "2024-01-15" might be Monday in
 * one timezone but still Sunday in another due to UTC offset differences.
 */
export function getWeekdayInTimezone(dateStr: string, timezone: string): number {
  // Parse the date string as midnight in the given timezone
  const localMidnight = fromZonedTime(new Date(`${dateStr}T12:00:00`), timezone)
  const zonedDate = toZonedTime(localMidnight, timezone)
  return zonedDate.getDay()
}
