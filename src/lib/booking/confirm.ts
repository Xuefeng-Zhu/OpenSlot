import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { ConfirmBookingInput, ConfirmBookingResult } from './types'

interface ConfirmBookingRpcRow {
  success: boolean
  error_code: string | null
  booking_id: string | null
  cancellation_token: string | null
  reschedule_token: string | null
}

/**
 * Confirms a booking from an active hold.
 *
 * The database RPC performs the booking insert, hold promotion, reservation
 * conversion, audit append, and outbox enqueue in one transaction.
 */
export async function confirmBooking(
  input: ConfirmBookingInput,
  adminClient: SupabaseClient<Database>
): Promise<ConfirmBookingResult> {
  const { holdToken, guestName, guestEmail, guestTimezone, notes } = input

  const { data, error } = await adminClient.rpc('confirm_booking_from_hold', {
    p_hold_token: holdToken,
    p_guest_name: guestName,
    p_guest_email: guestEmail,
    p_guest_timezone: guestTimezone,
    p_notes: notes ?? '',
  })

  if (error) {
    if (error.code === '23P01') {
      return {
        success: false,
        error: 'This slot has been booked by someone else. Please select a different time.',
      }
    }

    console.error('Error creating booking:', {
      code: error.code,
      message: error.message,
    })
    return { success: false, error: 'Failed to create booking.' }
  }

  const row = ((data ?? [])[0] ?? null) as ConfirmBookingRpcRow | null

  if (!row) {
    return { success: false, error: 'Failed to create booking.' }
  }

  if (!row.success) {
    return { success: false, error: confirmBookingErrorMessage(row.error_code) }
  }

  if (
    !row.booking_id ||
    !row.cancellation_token ||
    !row.reschedule_token
  ) {
    console.error('Booking confirmation RPC returned incomplete success row')
    return { success: false, error: 'Failed to create booking.' }
  }

  return {
    success: true,
    bookingId: row.booking_id,
    cancellationToken: row.cancellation_token,
    rescheduleToken: row.reschedule_token,
  }
}

function confirmBookingErrorMessage(errorCode: string | null): string {
  if (errorCode === 'hold_not_found') {
    return 'Hold not found or already used'
  }

  if (errorCode === 'hold_expired') {
    return 'Hold has expired. Please select a new slot.'
  }

  console.error('Unknown booking confirmation error:', errorCode)
  return 'Failed to create booking.'
}
