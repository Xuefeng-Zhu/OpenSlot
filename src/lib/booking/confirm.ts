import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database, Tables } from '@/lib/types/database'
import type { ConfirmBookingInput, ConfirmBookingResult } from './types'
import {
  enqueueBookingConfirmedOutbox,
  enqueueConfiguredBookingReminderOutbox,
} from '@/lib/outbox/outbox'
import {
  convertHoldReservationToBooking,
  expireHoldReservation,
} from '@/lib/reservations/host-reservations'
import { upsertContactFromBooking } from '@/lib/contacts/contacts'
import { appendBookingEvent } from './events'
import {
  normalizeInviteeQuestions,
  parseInviteeAnswers,
} from '@/lib/validations/invitee-questions'
import type { Json } from '@/lib/types/database'
import { verifyFinalProviderAvailability } from '@/lib/calendar/final-availability'
import { shouldUseFunctionFallback } from '@/lib/backend/compat/function-fallback'

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
  adminClient: BackendCompatClient<Database>
): Promise<ConfirmBookingResult> {
  const { holdToken, guestName, guestEmail, guestTimezone, notes, answers } = input

  // Step 1: Fetch and validate the hold
  let hold = await loadActiveHold(adminClient, holdToken)

  if (!hold) {
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
    .select(
      'location_type, location_value, video_provider, invitee_questions, buffer_before_minutes, buffer_after_minutes'
    )
    .eq('id', hold.event_type_id)
    .single()

  if (eventTypeError || !eventTypeData) {
    return { success: false, error: 'Failed to load event type.' }
  }

  const eventType = eventTypeData as Pick<
    Tables<'event_types'>,
    | 'location_type'
    | 'location_value'
    | 'video_provider'
    | 'invitee_questions'
    | 'buffer_before_minutes'
    | 'buffer_after_minutes'
  >
  const conferenceProvider =
    eventType.location_type === 'video_provider' ? eventType.video_provider : null

  const inviteeQuestions = normalizeInviteeQuestions(
    eventType.invitee_questions
  )
  const parsedAnswers = parseInviteeAnswers(inviteeQuestions, answers ?? {})

  if (!parsedAnswers.success) {
    return {
      success: false,
      error: 'Booking answers validation failed.',
    }
  }

  const finalAvailability = await verifyFinalProviderAvailability(adminClient, {
    hostUserId: hold.host_user_id,
    startAt: hold.start_at,
    endAt: hold.end_at,
    bufferBeforeMinutes: eventType.buffer_before_minutes,
    bufferAfterMinutes: eventType.buffer_after_minutes,
  })

  if (!finalAvailability.success) {
    return { success: false, error: finalAvailability.error }
  }

  const functionResult = await confirmBookingWithBackendFunction(adminClient, {
    holdToken,
    guestName,
    guestEmail,
    guestTimezone,
    notes,
    parsedAnswers: parsedAnswers.data as Json,
    locationType: eventType.location_type,
    locationValue: eventType.location_value ?? '',
    conferenceProvider,
  })

  if (functionResult.attempted && !('fallback' in functionResult)) {
    if (!functionResult.success) {
      return {
        success: false,
        error: functionResult.error,
      }
    }

    const booking = functionResult.booking

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

    await enqueueConfiguredBookingReminderOutbox(adminClient, {
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

  if (functionResult.attempted && 'fallback' in functionResult) {
    hold = await loadActiveHold(adminClient, holdToken)

    if (!hold) {
      return { success: false, error: 'Hold not found or already used' }
    }

    if (new Date(hold.expires_at) < new Date()) {
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
      booking_answers: parsedAnswers.data as Json,
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

  await enqueueConfiguredBookingReminderOutbox(adminClient, {
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

async function loadActiveHold(
  adminClient: BackendCompatClient<Database>,
  holdToken: string
): Promise<Tables<'slot_holds'> | null> {
  const { data, error } = await adminClient
    .from('slot_holds')
    .select('*')
    .eq('hold_token', holdToken)
    .eq('status', 'active')
    .single()

  if (error || !data) return null

  return data as Tables<'slot_holds'>
}

type ConfirmFunctionBooking = {
  id: string
  cancellation_token: string
  reschedule_token: string
  conference_status: string
  conference_url: string | null
}

type ConfirmFunctionResult =
  | { attempted: false }
  | { attempted: true; success: true; booking: ConfirmFunctionBooking }
  | { attempted: true; success: false; error: string }
  | { attempted: true; fallback: true }

async function confirmBookingWithBackendFunction(
  adminClient: BackendCompatClient<Database>,
  input: {
    holdToken: string
    guestName: string
    guestEmail: string
    guestTimezone: string
    notes?: string
    parsedAnswers: Json
    locationType: string
    locationValue: string
    conferenceProvider: string | null
  }
): Promise<ConfirmFunctionResult> {
  if (typeof adminClient.rpc !== 'function') return { attempted: false }

  const { data, error } = await adminClient
    .rpc('confirm_booking', {
      p_hold_token: input.holdToken,
      p_guest_name: input.guestName,
      p_guest_email: input.guestEmail,
      p_guest_timezone: input.guestTimezone,
      p_notes: input.notes ?? '',
      p_booking_answers: input.parsedAnswers,
      p_location_type: input.locationType,
      p_location_value: input.locationValue,
      p_conference_provider: input.conferenceProvider,
      p_conference_status: input.conferenceProvider ? 'pending' : 'not_required',
    })
    .single<{
      booking_id: string
      cancellation_token: string
      reschedule_token: string
      conference_status: string
      conference_url: string | null
    }>()

  if (error || !data) {
    if (shouldUseFunctionFallback(error)) {
      console.warn(
        'Falling back to non-transactional booking confirmation because the backend function is unavailable:',
        error
      )
      return { attempted: true, fallback: true }
    }

    if (error?.code === '23P01') {
      return {
        attempted: true,
        success: false,
        error:
          'This slot has been booked by someone else. Please select a different time.',
      }
    }

    console.error('Error confirming booking through backend function:', error)
    return {
      attempted: true,
      success: false,
      error: 'Failed to create booking.',
    }
  }

  return {
    attempted: true,
    success: true,
    booking: {
      id: data.booking_id,
      cancellation_token: data.cancellation_token,
      reschedule_token: data.reschedule_token,
      conference_status: data.conference_status,
      conference_url: data.conference_url,
    },
  }
}
