/**
 * Booking engine type definitions.
 *
 * These interfaces define the inputs and outputs for the hold, confirm,
 * and cancel operations in the booking flow.
 */

export interface CreateHoldInput {
  eventTypeId: string
  hostUserId: string
  startAt: string // ISO 8601 UTC
  endAt: string // ISO 8601 UTC
  guestEmail: string
}

export interface CreateHoldResult {
  success: boolean
  holdId?: string
  holdToken?: string
  expiresAt?: string
  error?: string
}

export interface ConfirmBookingInput {
  holdToken: string
  guestName: string
  guestEmail: string
  guestTimezone: string
  notes?: string
}

export interface ConfirmBookingResult {
  success: boolean
  bookingId?: string
  cancellationToken?: string
  rescheduleToken?: string
  error?: string
}

export interface CancelBookingInput {
  cancellationToken: string
  cancelReason?: string
}

export interface CancelBookingResult {
  success: boolean
  error?: string
}
