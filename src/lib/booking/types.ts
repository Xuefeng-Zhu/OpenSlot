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
  idempotencyKey?: string
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
  idempotencyKey?: string
}

export interface CancelBookingResult {
  success: boolean
  error?: string
}

export interface RescheduleBookingInput {
  rescheduleToken: string
  holdToken: string
  guestName: string
  guestEmail: string
  guestTimezone: string
  notes?: string
  idempotencyKey?: string
}

export interface RescheduleBookingResult {
  success: boolean
  bookingId?: string
  previousBookingId?: string
  cancellationToken?: string
  rescheduleToken?: string
  startAt?: string
  endAt?: string
  previousStartAt?: string
  previousEndAt?: string
  error?: string
}
