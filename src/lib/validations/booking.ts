import { z } from 'zod'
import { isValidTimezone } from '@/lib/validations/profile'

/**
 * Schema for creating a slot hold.
 * Used by POST /api/holds to validate the request body.
 */
export const createHoldSchema = z.object({
  eventTypeId: z.string().uuid('Event type ID must be a valid UUID'),
  hostUserId: z.string().uuid('Host user ID must be a valid UUID'),
  startAt: z.string().datetime({ message: 'Start time must be a valid ISO 8601 datetime' }),
  endAt: z.string().datetime({ message: 'End time must be a valid ISO 8601 datetime' }),
  guestEmail: z.string().email('Must be a valid email address'),
})

export type CreateHoldInput = z.infer<typeof createHoldSchema>

/**
 * Schema for confirming a booking from a hold.
 * Used by POST /api/bookings to validate the request body.
 */
export const confirmBookingSchema = z.object({
  holdToken: z.string().uuid('Hold token must be a valid UUID'),
  guestName: z.string().min(1, 'Guest name is required').max(100, 'Guest name must be 100 characters or less'),
  guestEmail: z.string().email('Must be a valid email address'),
  guestTimezone: z.string().refine(isValidTimezone, { message: 'Must be a valid IANA timezone' }),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
})

export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>

/**
 * Schema for cancelling a booking.
 * Used by POST /api/bookings/[id]/cancel to validate the request body.
 */
export const cancelBookingSchema = z.object({
  cancellationToken: z.string().uuid('Cancellation token must be a valid UUID'),
  cancelReason: z.string().max(500, 'Cancel reason must be 500 characters or less').optional(),
})

export type CancelBookingSchemaInput = z.infer<typeof cancelBookingSchema>
