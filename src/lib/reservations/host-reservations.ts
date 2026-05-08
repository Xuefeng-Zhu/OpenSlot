import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

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
