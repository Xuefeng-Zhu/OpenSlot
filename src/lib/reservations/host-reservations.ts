import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/**
 * Marks the reservation mirror for an expired hold.
 * This is a best-effort companion write used after lazy hold expiration so the
 * host reservation exclusion constraint no longer blocks the old time range.
 */
export async function expireHoldReservation(
  adminClient: SupabaseClient<Database>,
  holdId: string
): Promise<boolean> {
  return updateReservationStatus(adminClient, {
    source: 'hold',
    sourceId: holdId,
    status: 'expired',
  })
}

/**
 * Repoints the reservation mirror from a hold to the confirmed booking.
 * The time range stays the same, but the source becomes durable so cancellation
 * and later reconciliation can release the correct reservation row.
 */
export async function convertHoldReservationToBooking(
  adminClient: SupabaseClient<Database>,
  {
    holdId,
    bookingId,
  }: {
    holdId: string
    bookingId: string
  }
): Promise<boolean> {
  const { error } = await adminClient
    .from('host_reservations')
    .update({
      source: 'booking',
      source_id: bookingId,
      expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('source', 'hold')
    .eq('source_id', holdId)

  if (error) {
    logReservationError('Error converting hold reservation:', error, {
      source: 'hold',
      sourceId: holdId,
      nextSource: 'booking',
      nextSourceId: bookingId,
    })
    return false
  }

  return true
}

/**
 * Releases the reservation mirror for a cancelled booking.
 * Booking cancellation should not fail solely because this mirror update fails;
 * callers get a boolean and errors are logged with reservation context.
 */
export async function cancelBookingReservation(
  adminClient: SupabaseClient<Database>,
  bookingId: string
): Promise<boolean> {
  return updateReservationStatus(adminClient, {
    source: 'booking',
    sourceId: bookingId,
    status: 'cancelled',
  })
}

async function updateReservationStatus(
  adminClient: SupabaseClient<Database>,
  {
    source,
    sourceId,
    status,
  }: {
    source: 'hold' | 'booking'
    sourceId: string
    status: 'expired' | 'cancelled' | 'released'
  }
): Promise<boolean> {
  const { error } = await adminClient
    .from('host_reservations')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('source', source)
    .eq('source_id', sourceId)

  if (error) {
    logReservationError('Error updating host reservation:', error, {
      source,
      sourceId,
      status,
    })
    return false
  }

  return true
}

function logReservationError(
  message: string,
  error: { code?: string; message?: string },
  context: Record<string, string>
) {
  console.error(message, {
    code: error.code,
    message: error.message,
    ...context,
  })
}
