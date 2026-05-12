import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/lib/types/database'
import type { ConfirmBookingInput, ConfirmBookingResult } from './types'
import { enqueueBookingConfirmedOutbox } from '@/lib/outbox/outbox'
import {
  convertHoldReservationToBooking,
  expireHoldReservation,
} from '@/lib/reservations/host-reservations'
import { upsertContactFromBooking } from '@/lib/contacts/contacts'
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
 * 8. Emails and external side effects are processed from the outbox
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

  const { data: eventTypeData, error: eventTypeError } = await adminClient
    .from('event_types')
    .select('location_type, location_value, video_provider')
    .eq('id', hold.event_type_id)
    .single()

  if (eventTypeError || !eventTypeData) {
    return { success: false, error: 'Failed to load event type.' }
  }

  const eventType = eventTypeData as Pick<
    Tables<'event_types'>,
    'location_type' | 'location_value' | 'video_provider'
  >
  const conferenceProvider =
    eventType.location_type === 'video_provider' ? eventType.video_provider : null

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
      location_type: eventType.location_type,
      location_value: eventType.location_value ?? '',
      conference_provider: conferenceProvider,
      conference_status: conferenceProvider ? 'pending' : 'not_required',
      conference_error: null,
    })
    .select('id, cancellation_token, reschedule_token, conference_status, conference_url')
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

  await upsertContactFromBooking(adminClient, {
    bookingId: booking.id,
    hostUserId: hold.host_user_id,
    guestName,
    guestEmail,
    guestTimezone,
  })

  await enqueueBookingConfirmedOutbox(adminClient, {
    bookingId: booking.id,
    eventTypeId: hold.event_type_id,
    hostUserId: hold.host_user_id,
    startAt: hold.start_at,
    endAt: hold.end_at,
  })

  return {
    success: true,
    bookingId: booking.id,
    cancellationToken: booking.cancellation_token,
    rescheduleToken: booking.reschedule_token,
    conferenceStatus: booking.conference_status,
    conferenceUrl: booking.conference_url,
  }
}
