/**
 * Timezone conversion utilities using date-fns-tz.
 *
 * These helpers wrap date-fns-tz functions to provide a clear API
 * for converting between UTC and host/guest timezones, and for
 * determining the weekday in a specific timezone.
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz'

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
