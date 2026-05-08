import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { CancelBookingInput, CancelBookingResult } from './types'
import { sendCancellationEmail } from '@/lib/email/send'
import type { BookingDetails } from '@/lib/email/send'
import { enqueueBookingCancelledOutbox } from '@/lib/outbox/outbox'
import { cancelBookingReservation } from '@/lib/reservations/host-reservations'

/**
 * Cancels a confirmed booking using its cancellation token.
 *
 * Flow:
 * 1. Fetch booking by cancellation_token where status='confirmed'
 * 2. If not found → return error
 * 3. If already cancelled → return "already cancelled" error
 * 4. Update status to 'cancelled' and store cancel_reason
 * 5. Enqueue outbox side-effect events
 * 6. Fetch event type and host profile for email details
 * 7. Fire-and-forget cancellation emails to both guest and host
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

  await enqueueBookingCancelledOutbox(adminClient, {
    bookingId: booking.id,
    eventTypeId: booking.event_type_id,
    hostUserId: booking.host_user_id,
    startAt: booking.start_at,
    endAt: booking.end_at,
    cancelReasonProvided: Boolean(cancelReason),
  })

  // Step 4: Fetch event type and host profile for email details
  const [eventTypeResult, hostProfileResult] = await Promise.all([
    adminClient
      .from('event_types')
      .select('title')
      .eq('id', booking.event_type_id)
      .single(),
    adminClient
      .from('profiles')
      .select('name, email')
      .eq('id', booking.host_user_id)
      .single(),
  ])

  const eventTitle = eventTypeResult.data?.title ?? 'Meeting'
  const hostName = hostProfileResult.data?.name ?? 'Host'
  const hostEmail = hostProfileResult.data?.email ?? ''

  // Step 5: Send cancellation emails (fire-and-forget)
  const bookingDetails: BookingDetails = {
    bookingId: booking.id,
    eventTitle,
    startAt: booking.start_at,
    endAt: booking.end_at,
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    guestTimezone: booking.guest_timezone,
    hostName,
    hostEmail,
  }

  sendCancellationEmail(bookingDetails, 'guest').catch(console.error)
  sendCancellationEmail(bookingDetails, 'host').catch(console.error)

  return { success: true }
}
