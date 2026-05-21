import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database, Json } from '@/lib/types/database'

export type BookingEventType =
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'booking.rescheduled'
export type BookingEventActorType = 'system' | 'host' | 'guest'

export interface AppendBookingEventInput {
  bookingId: string
  eventType: BookingEventType
  actorType?: BookingEventActorType
  actorId?: string | null
  payload?: Json
}

/**
 * Appends a durable audit event for a booking lifecycle transition.
 * This is intentionally best-effort and returns false on write failure so the
 * primary booking mutation does not roll back after it has already succeeded.
 */
export async function appendBookingEvent(
  adminClient: BackendCompatClient<Database>,
  event: AppendBookingEventInput
): Promise<boolean> {
  const { error } = await adminClient
    .from('booking_events')
    .insert({
      booking_id: event.bookingId,
      event_type: event.eventType,
      actor_type: event.actorType ?? 'system',
      actor_id: event.actorId ?? null,
      payload: event.payload ?? {},
    })

  if (error) {
    console.error('Error appending booking event:', {
      code: error.code,
      message: error.message,
      bookingId: event.bookingId,
      eventType: event.eventType,
      actorType: event.actorType ?? 'system',
    })
    return false
  }

  return true
}
