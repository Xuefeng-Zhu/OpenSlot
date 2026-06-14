import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database } from '@/lib/types/database'
import type { CancelBookingInput, CancelBookingResult } from './types'
import { touchContactForBookingEvent } from '@/lib/contacts/contacts'

/**
 * Cancels a confirmed booking using its cancellation token.
 *
 * The atomic `cancel_booking` RPC performs the booking status update, host
 * reservation release, `booking_events` append, and `outbox_events` enqueue
 * in a single database transaction. This function performs only the
 * best-effort post-RPC contact touch, sourced from a minimal pre-fetch that
 * selects just the host identity the contact touch needs.
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
  } = input;

  // 1. Atomic cancel RPC: booking status flip + reservation release +
  // booking_events + outbox_events all in one transaction.
  const { error: rpcError } = await adminClient.rpc('cancel_booking', {
    p_cancellation_token: cancellationToken,
    p_cancel_reason: cancelReason ?? null,
    p_actor_type: actorType,
    p_actor_id: actorId,
  });

  if (rpcError) {
    return { success: false, error: cancelRpcErrorMessage(rpcError) };
  }

  // 2. Best-effort post-RPC contact touch. A minimal pre-fetch supplies the
  // host identity; failures here must not undo the already-committed cancel.
  const { data: contactRow } = await adminClient
    .from('bookings')
    .select('host_user_id, guest_email')
    .eq('cancellation_token', cancellationToken)
    .maybeSingle();

  if (contactRow) {
    await touchContactForBookingEvent(adminClient, {
      hostUserId: contactRow.host_user_id,
      guestEmail: contactRow.guest_email,
    });
  }

  return { success: true };
}

function cancelRpcErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message ?? '';

  if (message.includes('booking_not_found')) {
    return 'Booking not found';
  }

  if (message.includes('booking_already_cancelled')) {
    return 'Booking has already been cancelled';
  }

  if (message.includes('booking_already_rescheduled')) {
    return 'Booking has been rescheduled';
  }

  console.error('Error cancelling booking through backend function:', {
    code: error?.code,
    message: error?.message,
  });

  return 'Failed to cancel booking';
}
