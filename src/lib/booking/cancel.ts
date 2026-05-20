import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database } from '@/lib/types/database'
import type { CancelBookingInput, CancelBookingResult } from './types'
import { enqueueBookingCancelledOutbox } from '@/lib/outbox/outbox'
import { cancelBookingReservation } from '@/lib/reservations/host-reservations'
import { touchContactForBookingEvent } from '@/lib/contacts/contacts'
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
  adminClient: BackendCompatClient<Database>
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

  const functionResult = await cancelBookingWithBackendFunction(adminClient, {
    cancellationToken,
    cancelReason,
  })

  if (functionResult.attempted) {
    if (!functionResult.success) {
      return { success: false, error: functionResult.error }
    }

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

    await touchContactForBookingEvent(adminClient, {
      hostUserId: booking.host_user_id,
      guestEmail: booking.guest_email,
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

  await touchContactForBookingEvent(adminClient, {
    hostUserId: booking.host_user_id,
    guestEmail: booking.guest_email,
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

type CancelFunctionResult =
  | { attempted: false }
  | { attempted: true; success: true }
  | { attempted: true; success: false; error: string }

async function cancelBookingWithBackendFunction(
  adminClient: BackendCompatClient<Database>,
  input: {
    cancellationToken: string
    cancelReason?: string
  }
): Promise<CancelFunctionResult> {
  if (typeof adminClient.rpc !== 'function') return { attempted: false }

  const { error } = await adminClient.rpc('cancel_booking', {
    p_cancellation_token: input.cancellationToken,
    p_cancel_reason: input.cancelReason ?? null,
  })

  if (error) {
    console.error('Error cancelling booking through backend function:', error)
    return {
      attempted: true,
      success: false,
      error: 'Failed to cancel booking',
    }
  }

  return {
    attempted: true,
    success: true,
  }
}
