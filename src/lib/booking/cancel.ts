import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { CancelBookingInput, CancelBookingResult } from './types'
import { enqueueBookingCancelledOutbox } from '@/lib/outbox/outbox'
import { cancelBookingReservation } from '@/lib/reservations/host-reservations'
import { appendBookingEvent } from './events'

/**
 * Cancels a confirmed booking using its cancellation token.
 *
 * Flow:
 * 1. Fetch booking by cancellation_token where status='confirmed'
 * 2. If not found → return error
 * 3. If already cancelled → return "already cancelled" error
 * 4. Update status to 'cancelled' and store cancel_reason
 * 5. Enqueue outbox side-effect events
 * 6. Emails and external side effects are processed from the outbox
 * 8. Return success
 */
export async function cancelBooking(
  input: CancelBookingInput,
  adminClient: SupabaseClient<Database>
): Promise<CancelBookingResult> {
  const { cancellationToken, cancelReason } = input

  // Step 1: Fetch booking by cancellation token
  const { data: booking, error: fetchError } = await adminClient
    .from('bookings')
    .select('*')
    .eq('cancellation_token', cancellationToken)
    .single()

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found' }
  }

  // Step 2: Check if already cancelled
  if (booking.status === 'cancelled') {
    return { success: false, error: 'Booking has already been cancelled' }
  }

  // Step 3: Update booking status to cancelled
  const { error: updateError } = await adminClient
    .from('bookings')
    .update({
      status: 'cancelled',
      cancel_reason: cancelReason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id)

  if (updateError) {
    console.error('Error cancelling booking:', updateError)
    return { success: false, error: 'Failed to cancel booking' }
  }

  await cancelBookingReservation(adminClient, booking.id)

  await appendBookingEvent(adminClient, {
    bookingId: booking.id,
    eventType: 'booking.cancelled',
    actorType: 'guest',
    payload: {
      eventTypeId: booking.event_type_id,
      hostUserId: booking.host_user_id,
      startAt: booking.start_at,
      endAt: booking.end_at,
      cancelReasonProvided: Boolean(cancelReason),
    },
  })

  await enqueueBookingCancelledOutbox(adminClient, {
    bookingId: booking.id,
    eventTypeId: booking.event_type_id,
    hostUserId: booking.host_user_id,
    startAt: booking.start_at,
    endAt: booking.end_at,
    cancelReasonProvided: Boolean(cancelReason),
  })

  return { success: true }
}
