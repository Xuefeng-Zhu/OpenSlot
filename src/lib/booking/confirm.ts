import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { ConfirmBookingInput, ConfirmBookingResult } from './types'
import {
  sendBookingConfirmationToGuest,
  sendBookingNotificationToHost,
} from '@/lib/email/send'
import type { BookingDetails } from '@/lib/email/send'
import { enqueueBookingConfirmedOutbox } from '@/lib/outbox/outbox'
import {
  convertHoldReservationToBooking,
  expireHoldReservation,
} from '@/lib/reservations/host-reservations'
import { appendBookingEvent } from './events'

/**
 * Confirms a booking from an active hold.
 *
 * Flow:
 * 1. Fetch hold by hold_token where status='active'
 * 2. If not found → return error
 * 3. If expired (expires_at < now) → lazy update status to 'expired', return error
 * 4. Insert booking with status='confirmed' (exclusion constraint provides final guard)
 * 5. If insert fails with code '23P01' → return "slot taken" error
 * 6. Update hold status to 'confirmed'
 * 7. Enqueue outbox side-effect events
 * 8. Fire-and-forget email notifications
 * 9. Return success with bookingId, cancellationToken, rescheduleToken
 */
export async function confirmBooking(
  input: ConfirmBookingInput,
  adminClient: SupabaseClient<Database>
): Promise<ConfirmBookingResult> {
  const { holdToken, guestName, guestEmail, guestTimezone, notes } = input

  // Step 1: Fetch and validate the hold
  const { data: hold, error: holdError } = await adminClient
    .from('slot_holds')
    .select('*')
    .eq('hold_token', holdToken)
    .eq('status', 'active')
    .single()

  if (holdError || !hold) {
    return { success: false, error: 'Hold not found or already used' }
  }

  // Step 2: Check hold expiration (lazy cleanup)
  if (new Date(hold.expires_at) < new Date()) {
    // Lazy update: mark the hold as expired
    await adminClient
      .from('slot_holds')
      .update({ status: 'expired' })
      .eq('id', hold.id)
    await expireHoldReservation(adminClient, hold.id)

    return {
      success: false,
      error: 'Hold has expired. Please select a new slot.',
    }
  }

  // Step 3: Insert booking (exclusion constraint provides final guard against double-booking)
  const { data: booking, error: bookingError } = await adminClient
    .from('bookings')
    .insert({
      event_type_id: hold.event_type_id,
      host_user_id: hold.host_user_id,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_timezone: guestTimezone,
      notes: notes ?? '',
      start_at: hold.start_at,
      end_at: hold.end_at,
      status: 'confirmed',
    })
    .select('id, cancellation_token, reschedule_token')
    .single()

  if (bookingError) {
    // PostgreSQL exclusion constraint violation = slot taken by another booking
    if (bookingError.code === '23P01') {
      return {
        success: false,
        error: 'This slot has been booked by someone else. Please select a different time.',
      }
    }
    console.error('Error creating booking:', bookingError)
    return { success: false, error: 'Failed to create booking.' }
  }

  // Step 4: Mark hold as confirmed
  await adminClient
    .from('slot_holds')
    .update({ status: 'confirmed' })
    .eq('id', hold.id)

  await convertHoldReservationToBooking(adminClient, {
    holdId: hold.id,
    bookingId: booking.id,
  })

  await appendBookingEvent(adminClient, {
    bookingId: booking.id,
    eventType: 'booking.confirmed',
    payload: {
      eventTypeId: hold.event_type_id,
      hostUserId: hold.host_user_id,
      startAt: hold.start_at,
      endAt: hold.end_at,
    },
  })

  await enqueueBookingConfirmedOutbox(adminClient, {
    bookingId: booking.id,
    eventTypeId: hold.event_type_id,
    hostUserId: hold.host_user_id,
    startAt: hold.start_at,
    endAt: hold.end_at,
  })

  // Step 5: Fetch event type and host profile for email details
  const [eventTypeResult, hostProfileResult] = await Promise.all([
    adminClient
      .from('event_types')
      .select('title')
      .eq('id', hold.event_type_id)
      .single(),
    adminClient
      .from('profiles')
      .select('name, email')
      .eq('id', hold.host_user_id)
      .single(),
  ])

  const eventTitle = eventTypeResult.data?.title ?? 'Meeting'
  const hostName = hostProfileResult.data?.name ?? 'Host'
  const hostEmail = hostProfileResult.data?.email ?? ''

  // Step 6: Send email notifications (fire-and-forget)
  const bookingDetails: BookingDetails = {
    bookingId: booking.id,
    eventTitle,
    startAt: hold.start_at,
    endAt: hold.end_at,
    guestName,
    guestEmail,
    guestTimezone,
    hostName,
    hostEmail,
    cancellationToken: booking.cancellation_token,
  }

  sendBookingConfirmationToGuest(bookingDetails).catch(console.error)
  sendBookingNotificationToHost(bookingDetails).catch(console.error)

  return {
    success: true,
    bookingId: booking.id,
    cancellationToken: booking.cancellation_token,
    rescheduleToken: booking.reschedule_token,
  }
}
