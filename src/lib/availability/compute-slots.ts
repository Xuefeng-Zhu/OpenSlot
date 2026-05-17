/**
 * Slot Computation Engine
 *
 * This is the core algorithm of the OpenSlot scheduling platform.
 * It computes available time slots for a given date based on:
 * - Weekly availability rules
 * - Date-specific overrides
 * - Existing bookings, active holds, and synced calendar busy windows
 *   (with buffer consideration)
 * - Minimum notice and maximum booking window constraints
 *
 * All returned slots are in ISO 8601 UTC format.
 */

import { addMinutes, addDays, parseISO, isBefore, isAfter } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import type {
  AvailabilityRule,
  AvailabilityOverride,
  TimeSlot,
  ComputeSlotsInput,
} from './types'

/**
 * Parse a date string and time string into a UTC Date, given the timezone
 * the time is expressed in.
 *
 * @param dateStr - "YYYY-MM-DD" date
 * @param timeStr - "HH:mm" local time
 * @param timezone - IANA timezone identifier
 * @returns UTC Date representing that local time on that date
 */
function parseLocalTimeToUTC(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date {
  // Build a local datetime string and convert from the given timezone to UTC
  const [hours, minutes] = timeStr.split(':').map(Number)
  // Create a date object representing the local time
  const localDate = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
  return fromZonedTime(localDate, timezone)
}

/**
 * Check if two time ranges overlap.
 * Range A: [startA, endA) and Range B: [startB, endB)
 * They overlap if startA < endB AND startB < endA
 */
function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return isBefore(startA, endB) && isBefore(startB, endA)
}

/**
 * Compute available time slots for a given date.
 *
 * Algorithm:
 * 1. Convert requested date to host timezone to determine weekday
 * 2. Check for date-specific overrides:
 *    a. If override marks day unavailable → return []
 *    b. If override provides custom hours → use those instead of weekly rules
 * 3. Get applicable weekly rules for that weekday (if no override)
 * 4. Generate candidate slots by stepping through each availability window
 *    in increments of durationMinutes
 * 5. For each candidate slot, compute the "blocked range":
 *    [start - buffer_before, end + buffer_after]
 * 6. Filter out candidates where:
 *    a. Blocked range overlaps any confirmed booking
 *    b. Blocked range overlaps any active (non-expired) hold
 *    c. Blocked range overlaps any synced external calendar busy window
 *    d. Start time is within min_notice_minutes of now
 *    e. Start time is beyond max_booking_days_ahead from today
 * 7. Return sorted array of available slots (UTC ISO strings)
 */
export function computeAvailableSlots(
  input: ComputeSlotsInput,
  rules: AvailabilityRule[],
  overrides: AvailabilityOverride[],
  existingBookings: TimeSlot[],
  activeHolds: TimeSlot[],
  externalBusySlots: TimeSlot[] = []
): TimeSlot[] {
  const {
    date,
    durationMinutes,
    bufferBeforeMinutes,
    bufferAfterMinutes,
    minNoticeMinutes,
    maxBookingDaysAhead,
    scheduleTimezone,
  } = input

  const now = new Date()
  const earliestStart = addMinutes(now, minNoticeMinutes)
  const latestStart = addDays(now, maxBookingDaysAhead)

  // Step 1: Determine the host schedule timezone and weekday for the requested date.
  const hostTimezone =
    scheduleTimezone ?? rules[0]?.timezone ?? overrides[0]?.timezone ?? 'UTC'

  // Determine the weekday for the requested date in the host's timezone
  // Parse the date as noon local time to avoid DST edge cases at midnight
  const noonLocal = new Date(`${date}T12:00:00`)
  const noonUTC = fromZonedTime(noonLocal, hostTimezone)
  const dateInHostTz = toZonedTime(noonUTC, hostTimezone)
  const weekday = dateInHostTz.getDay()

  // Step 2: Check for date-specific overrides
  const dayOverrides = overrides.filter((o) => o.date === date)

  let windows: Array<{ start: string; end: string; timezone: string }>

  if (dayOverrides.length > 0) {
    // If any override marks the day as unavailable, return no slots
    const unavailableOverride = dayOverrides.find((o) => !o.is_available)
    if (unavailableOverride) return []

    // Use override hours (only those that are available with valid times)
    windows = dayOverrides
      .filter((o) => o.is_available && o.start_time && o.end_time)
      .map((o) => ({
        start: o.start_time!,
        end: o.end_time!,
        timezone: o.timezone,
      }))
  } else {
    // Step 3: Use weekly rules for the determined weekday
    windows = rules
      .filter((r) => r.weekday === weekday && r.is_active)
      .map((r) => ({
        start: r.start_time,
        end: r.end_time,
        timezone: r.timezone,
      }))
  }

  if (windows.length === 0) return []

  // Step 4: Generate candidate slots
  const candidates: TimeSlot[] = []

  for (const window of windows) {
    const windowStartUTC = parseLocalTimeToUTC(date, window.start, window.timezone)
    const windowEndUTC = parseLocalTimeToUTC(date, window.end, window.timezone)

    let slotStart = windowStartUTC
    while (true) {
      const slotEnd = addMinutes(slotStart, durationMinutes)
      // Slot must fit entirely within the availability window
      if (isAfter(slotEnd, windowEndUTC)) break

      candidates.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
      })

      // Step by duration to generate non-overlapping slots
      slotStart = addMinutes(slotStart, durationMinutes)
    }
  }

  // Step 5 & 6: Filter candidates
  const blockedRanges = [
    ...existingBookings,
    ...activeHolds,
    ...externalBusySlots,
  ]

  const availableSlots = candidates.filter((slot) => {
    const slotStart = parseISO(slot.start)
    const slotEnd = parseISO(slot.end)

    // 6d: Min notice check — slot must start after earliest allowed time
    if (isBefore(slotStart, earliestStart)) return false

    // 6e: Max days ahead check — slot must start before the latest allowed date
    if (isAfter(slotStart, latestStart)) return false

    // 6a, 6b & 6c: Compute the buffered range for overlap detection
    const blockedStart = addMinutes(slotStart, -bufferBeforeMinutes)
    const blockedEnd = addMinutes(slotEnd, bufferAfterMinutes)

    // Check for conflicts with existing bookings, active holds, and provider busy windows
    const hasConflict = blockedRanges.some((existing) => {
      const existingStart = parseISO(existing.start)
      const existingEnd = parseISO(existing.end)
      return rangesOverlap(blockedStart, blockedEnd, existingStart, existingEnd)
    })

    return !hasConflict
  })

  // Sort by start time (should already be sorted, but ensure it)
  availableSlots.sort(
    (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()
  )

  return availableSlots
}
