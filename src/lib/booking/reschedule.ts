import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { RescheduleBookingInput, RescheduleBookingResult } from './types'
import { appendBookingEvent } from './events'
import { enqueueBookingRescheduledOutbox } from '@/lib/outbox/outbox'

interface RescheduleRpcRow {
  old_booking_id: string
  new_booking_id: string
  event_type_id: string
  host_user_id: string
  start_at: string
  end_at: string
  previous_start_at: string
  previous_end_at: string
  cancellation_token: string
  reschedule_token: string
}

export async function rescheduleBooking(
  input: RescheduleBookingInput,
  adminClient: SupabaseClient<Database>
): Promise<RescheduleBookingResult> {
  const { data, error } = await adminClient.rpc('reschedule_booking_with_hold', {
    p_reschedule_token: input.rescheduleToken,
    p_hold_token: input.holdToken,
    p_guest_name: input.guestName,
    p_guest_email: input.guestEmail,
    p_guest_timezone: input.guestTimezone,
    p_notes: input.notes ?? '',
  })

  if (error) {
    if (error.code === '23P01') {
      return {
        success: false,
        error: 'This slot has been booked by someone else. Please select a different time.',
      }
    }

    return {
      success: false,
      error: rescheduleErrorMessage(error.message),
    }
  }

  const row = (data?.[0] ?? null) as RescheduleRpcRow | null

  if (!row) {
    return { success: false, error: 'Failed to reschedule booking' }
  }

  await appendBookingEvent(adminClient, {
    bookingId: row.old_booking_id,
    eventType: 'booking.rescheduled',
    actorType: 'guest',
    payload: {
      rescheduledToBookingId: row.new_booking_id,
      previousStartAt: row.previous_start_at,
      previousEndAt: row.previous_end_at,
      startAt: row.start_at,
      endAt: row.end_at,
    },
  })

  await appendBookingEvent(adminClient, {
    bookingId: row.new_booking_id,
    eventType: 'booking.confirmed',
    actorType: 'guest',
    payload: {
      rescheduledFromBookingId: row.old_booking_id,
      eventTypeId: row.event_type_id,
      hostUserId: row.host_user_id,
      startAt: row.start_at,
      endAt: row.end_at,
    },
  })

  await enqueueBookingRescheduledOutbox(adminClient, {
    bookingId: row.new_booking_id,
    previousBookingId: row.old_booking_id,
    eventTypeId: row.event_type_id,
    hostUserId: row.host_user_id,
    startAt: row.start_at,
    endAt: row.end_at,
    previousStartAt: row.previous_start_at,
    previousEndAt: row.previous_end_at,
  })

  return {
    success: true,
    bookingId: row.new_booking_id,
    previousBookingId: row.old_booking_id,
    cancellationToken: row.cancellation_token,
    rescheduleToken: row.reschedule_token,
    startAt: row.start_at,
    endAt: row.end_at,
    previousStartAt: row.previous_start_at,
    previousEndAt: row.previous_end_at,
  }
}

function rescheduleErrorMessage(message: string): string {
  if (message.includes('booking_not_found')) {
    return 'Booking not found or cannot be rescheduled'
  }

  if (message.includes('hold_not_found')) {
    return 'Hold not found or already used'
  }

  if (message.includes('hold_expired')) {
    return 'Hold has expired. Please select a new slot.'
  }

  if (message.includes('hold_does_not_match_booking')) {
    return 'Selected slot does not match this booking'
  }

  console.error('Error rescheduling booking:', message)
  return 'Failed to reschedule booking'
}
