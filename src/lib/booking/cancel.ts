import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { CancelBookingInput, CancelBookingResult } from './types'

interface CancelBookingRpcRow {
  success: boolean
  error_code: string | null
  booking_id: string | null
}

/**
 * Cancels a confirmed booking using its cancellation token.
 *
 * The database RPC updates booking state, releases the reservation mirror,
 * appends the audit event, and enqueues outbox rows in one transaction.
 */
export async function cancelBooking(
  input: CancelBookingInput,
  adminClient: SupabaseClient<Database>
): Promise<CancelBookingResult> {
  const { cancellationToken, cancelReason } = input

  const { data, error } = await adminClient.rpc('cancel_booking_by_token', {
    p_cancellation_token: cancellationToken,
    p_cancel_reason: cancelReason ?? null,
  })

  if (error) {
    console.error('Error cancelling booking:', {
      code: error.code,
      message: error.message,
    })
    return { success: false, error: 'Failed to cancel booking' }
  }

  const row = ((data ?? [])[0] ?? null) as CancelBookingRpcRow | null

  if (!row) {
    return { success: false, error: 'Failed to cancel booking' }
  }

  if (!row.success) {
    return { success: false, error: cancelBookingErrorMessage(row.error_code) }
  }

  return { success: true }
}

function cancelBookingErrorMessage(errorCode: string | null): string {
  if (errorCode === 'booking_not_found') {
    return 'Booking not found'
  }

  if (errorCode === 'booking_already_cancelled') {
    return 'Booking has already been cancelled'
  }

  console.error('Unknown booking cancellation error:', errorCode)
  return 'Failed to cancel booking'
}
