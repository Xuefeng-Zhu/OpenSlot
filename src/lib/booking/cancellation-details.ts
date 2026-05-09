import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, Tables } from '@/lib/types/database'

const cancellationTokenSchema = z.string().uuid()

export interface CancellationBookingDetails {
  bookingId: string
  cancellationToken: string
  eventTitle: string
  hostName: string
  guestName: string
  startAt: string
  endAt: string
  guestTimezone: string
  cancelledAt?: string
}

export type CancellationDetailsResult =
  | { status: 'active'; booking: CancellationBookingDetails }
  | { status: 'already-cancelled'; booking: CancellationBookingDetails }
  | { status: 'invalid' }

type CancellationBookingRow = Pick<
  Tables<'bookings'>,
  | 'id'
  | 'event_type_id'
  | 'host_user_id'
  | 'guest_name'
  | 'guest_timezone'
  | 'start_at'
  | 'end_at'
  | 'status'
  | 'cancellation_token'
  | 'updated_at'
>

/**
 * Checks cancellation tokens before doing a service-role lookup.
 * Invalid token shapes are rejected early so public pages do not query by
 * arbitrary strings.
 */
export function isValidCancellationToken(token: string): boolean {
  return cancellationTokenSchema.safeParse(token).success
}

/**
 * Looks up the public cancellation page details authorized by a cancellation token.
 *
 * The token is the public authorization boundary for this guest operation, so this
 * function only returns the minimum fields needed to render the cancellation page.
 */
export async function getCancellationDetails(
  cancellationToken: string,
  adminClient: SupabaseClient<Database>
): Promise<CancellationDetailsResult> {
  if (!isValidCancellationToken(cancellationToken)) {
    return { status: 'invalid' }
  }

  const { data: bookingData, error: bookingError } = await adminClient
    .from('bookings')
    .select(
      'id, event_type_id, host_user_id, guest_name, guest_timezone, start_at, end_at, status, cancellation_token, updated_at'
    )
    .eq('cancellation_token', cancellationToken)
    .single()

  if (bookingError || !bookingData) {
    if (bookingError && bookingError.code !== 'PGRST116') {
      console.error('Error loading cancellation booking:', bookingError)
    }
    return { status: 'invalid' }
  }

  const booking = bookingData as CancellationBookingRow

  if (booking.status !== 'confirmed' && booking.status !== 'cancelled') {
    return { status: 'invalid' }
  }

  const [eventTypeResult, hostProfileResult] = await Promise.all([
    adminClient
      .from('event_types')
      .select('title')
      .eq('id', booking.event_type_id)
      .single(),
    adminClient
      .from('profiles')
      .select('name')
      .eq('id', booking.host_user_id)
      .single(),
  ])

  const details: CancellationBookingDetails = {
    bookingId: booking.id,
    cancellationToken: booking.cancellation_token,
    eventTitle: eventTypeResult.data?.title ?? 'Meeting',
    hostName: hostProfileResult.data?.name ?? 'Host',
    guestName: booking.guest_name,
    startAt: booking.start_at,
    endAt: booking.end_at,
    guestTimezone: booking.guest_timezone,
    cancelledAt: booking.status === 'cancelled' ? booking.updated_at : undefined,
  }

  if (booking.status === 'cancelled') {
    return { status: 'already-cancelled', booking: details }
  }

  return { status: 'active', booking: details }
}
