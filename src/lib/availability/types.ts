/**
 * Types for the availability computation engine.
 *
 * These interfaces model the inputs and outputs of the slot computation
 * algorithm that determines which time slots are available for booking.
 */

export interface AvailabilityRule {
  id: string
  user_id: string
  weekday: number // 0 = Sunday, 6 = Saturday
  start_time: string // "HH:mm" local time
  end_time: string // "HH:mm" local time
  timezone: string // IANA timezone identifier
  is_active: boolean
}

export interface AvailabilityOverride {
  id: string
  user_id: string
  date: string // "YYYY-MM-DD"
  start_time: string | null // null if marking entire day unavailable
  end_time: string | null
  timezone: string // IANA timezone identifier
  is_available: boolean
  reason: string | null
}

export interface TimeSlot {
  start: string // ISO 8601 UTC
  end: string // ISO 8601 UTC
}

export interface ComputeSlotsInput {
  date: string // "YYYY-MM-DD" in guest timezone
  hostUserId: string
  eventTypeId: string
  guestTimezone: string
  durationMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  minNoticeMinutes: number
  maxBookingDaysAhead: number
}
