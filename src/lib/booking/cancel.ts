import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database, Tables } from '@/lib/types/database'
import type { CancelBookingInput, CancelBookingResult } from './types'
import { enqueueBookingCancelledOutbox } from '@/lib/outbox/outbox'
import { cancelBookingReservation } from '@/lib/reservations/host-reservations'
import { touchContactForBookingEvent } from '@/lib/contacts/contacts'
import { appendBookingEvent } from './events'
import { shouldUseFunctionFallback } from '@/lib/backend/compat/function-fallback'

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
  const {
    cancellationToken,
    cancelReason,
    actorType = 'guest',
    actorId = null,
  } = input
  const actor =
    actorId === null ? { actorType } : { actorType, actorId }

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

  let bookingForCancellation = booking as Tables<'bookings'>

  const functionResult = await cancelBookingWithBackendFunction(adminClient, {
    cancellationToken,
    cancelReason,
  })

  if (functionResult.attempted && !('fallback' in functionResult)) {
    if (!functionResult.success) {
      return { success: false, error: functionResult.error }
    }

    await appendBookingEvent(adminClient, {
      bookingId: booking.id,
      eventType: 'booking.cancelled',
      ...actor,
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

  if (functionResult.attempted && 'fallback' in functionResult) {
    const refreshedBooking = await loadConfirmedBookingByCancellationToken(
      adminClient,
      cancellationToken
    )

    if (!refreshedBooking) {
      return { success: false, error: 'Booking has already been cancelled' }
    }

    bookingForCancellation = refreshedBooking
  }

  // Step 3: Update booking status to cancelled
  const { data: updatedBookings, error: updateError } = await adminClient
    .from('bookings')
    .update({
      status: 'cancelled',
      cancel_reason: cancelReason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingForCancellation.id)
    .eq('status', 'confirmed')

  if (updateError) {
    console.error('Error cancelling booking:', updateError)
    return { success: false, error: 'Failed to cancel booking' }
  }

  if (!Array.isArray(updatedBookings) || updatedBookings.length !== 1) {
    return { success: false, error: 'Booking has already been cancelled' }
  }

  await cancelBookingReservation(adminClient, bookingForCancellation.id)

  await appendBookingEvent(adminClient, {
    bookingId: bookingForCancellation.id,
    eventType: 'booking.cancelled',
    ...actor,
    payload: {
      eventTypeId: bookingForCancellation.event_type_id,
      hostUserId: bookingForCancellation.host_user_id,
      startAt: bookingForCancellation.start_at,
      endAt: bookingForCancellation.end_at,
      cancelReasonProvided: Boolean(cancelReason),
    },
  })

  await touchContactForBookingEvent(adminClient, {
    hostUserId: bookingForCancellation.host_user_id,
    guestEmail: bookingForCancellation.guest_email,
  })

  await enqueueBookingCancelledOutbox(adminClient, {
    bookingId: bookingForCancellation.id,
    eventTypeId: bookingForCancellation.event_type_id,
    hostUserId: bookingForCancellation.host_user_id,
    startAt: bookingForCancellation.start_at,
    endAt: bookingForCancellation.end_at,
    cancelReasonProvided: Boolean(cancelReason),
  })

  return { success: true }
}

async function loadConfirmedBookingByCancellationToken(
  adminClient: BackendCompatClient<Database>,
  cancellationToken: string
): Promise<Tables<'bookings'> | null> {
  const { data, error } = await adminClient
    .from('bookings')
    .select('*')
    .eq('cancellation_token', cancellationToken)
    .eq('status', 'confirmed')
    .single()

  if (error || !data) return null

  return data as Tables<'bookings'>
}

type CancelFunctionResult =
  | { attempted: false }
  | { attempted: true; success: true }
  | { attempted: true; success: false; error: string }
  | { attempted: true; fallback: true }

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
    if (shouldUseFunctionFallback(error)) {
      console.warn(
        'Falling back to non-transactional booking cancellation because the backend function is unavailable:',
        error
      )
      return { attempted: true, fallback: true }
    }

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
