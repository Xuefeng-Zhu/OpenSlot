import type { SupabaseClient } from '@supabase/supabase-js'
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

export async function appendBookingEvent(
  adminClient: SupabaseClient<Database>,
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
