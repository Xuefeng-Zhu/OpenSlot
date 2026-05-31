import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database } from '@/lib/types/database'
import type { RescheduleBookingInput, RescheduleBookingResult } from './types'
import { appendBookingEvent } from './events'
import { upsertContactFromBooking } from '@/lib/contacts/contacts'
import {
  enqueueBookingRescheduledOutbox,
  enqueueConfiguredBookingReminderOutbox,
} from '@/lib/outbox/outbox'
import {
  normalizeInviteeQuestions,
  parseInviteeAnswers,
} from '@/lib/validations/invitee-questions'
import type { Json } from '@/lib/types/database'

interface RescheduleRpcRow {
  old_booking_id: string
  new_booking_id: string
  event_type_id: string
  host_user_id: string
  start_at: string
  end_at: string
  previous_start_at: string
  previous_end_at: string
  cancellation_token: string
  reschedule_token: string
  conference_status: string
  conference_url: string | null
}

/**
 * Reschedules an existing confirmed booking by consuming a newly created hold.
 * The database RPC performs the booking swap and reservation updates atomically;
 * this function records audit/outbox side effects after the transaction succeeds.
 */
export async function rescheduleBooking(
  input: RescheduleBookingInput,
  adminClient: BackendCompatClient<Database>
): Promise<RescheduleBookingResult> {
  const { data: existingBookingData, error: existingBookingError } =
    await adminClient
      .from('bookings')
      .select('event_type_id')
      .eq('reschedule_token', input.rescheduleToken)
      .eq('status', 'confirmed')
      .single()

  if (existingBookingError || !existingBookingData) {
    return { success: false, error: 'Booking not found or cannot be rescheduled' }
  }

  const { data: eventTypeData, error: eventTypeError } = await adminClient
    .from('event_types')
    .select('invitee_questions')
    .eq('id', existingBookingData.event_type_id)
    .single()

  if (eventTypeError || !eventTypeData) {
    console.error('Error loading event type questions:', eventTypeError)
    return { success: false, error: 'Failed to validate booking answers.' }
  }

  const parsedAnswers = parseInviteeAnswers(
    normalizeInviteeQuestions(eventTypeData.invitee_questions),
    input.answers ?? {}
  )

  if (!parsedAnswers.success) {
    return {
      success: false,
      error: 'Booking answers validation failed.',
    }
  }

  const { data, error } = await adminClient.rpc('reschedule_booking_with_hold', {
    p_reschedule_token: input.rescheduleToken,
    p_hold_token: input.holdToken,
    p_guest_name: input.guestName,
    p_guest_email: input.guestEmail,
    p_guest_timezone: input.guestTimezone,
    p_notes: input.notes ?? '',
    p_booking_answers: parsedAnswers.data as Json,
  })

  if (error) {
    if (error.code === '23P01') {
      return {
        success: false,
        error: 'This slot has been booked by someone else. Please select a different time.',
      }
    }

    return {
      success: false,
      error: rescheduleErrorMessage(error.message),
    }
  }

  const row = (data?.[0] ?? null) as RescheduleRpcRow | null

  if (!row) {
    return { success: false, error: 'Failed to reschedule booking' }
  }

  // Post-mutation side effects: wrapped in try/catch so a transient failure
  // does not hide the already-committed reschedule from the client.
  try {
    await appendBookingEvent(adminClient, {
      bookingId: row.old_booking_id,
      eventType: 'booking.rescheduled',
      actorType: 'guest',
      payload: {
        rescheduledToBookingId: row.new_booking_id,
        previousStartAt: row.previous_start_at,
        previousEndAt: row.previous_end_at,
        startAt: row.start_at,
        endAt: row.end_at,
      },
    })

    await appendBookingEvent(adminClient, {
      bookingId: row.new_booking_id,
      eventType: 'booking.confirmed',
      actorType: 'guest',
      payload: {
        rescheduledFromBookingId: row.old_booking_id,
        eventTypeId: row.event_type_id,
        hostUserId: row.host_user_id,
        startAt: row.start_at,
        endAt: row.end_at,
      },
    })

    await upsertContactFromBooking(adminClient, {
      bookingId: row.new_booking_id,
      hostUserId: row.host_user_id,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      guestTimezone: input.guestTimezone,
    })

    await enqueueBookingRescheduledOutbox(adminClient, {
      bookingId: row.new_booking_id,
      previousBookingId: row.old_booking_id,
      eventTypeId: row.event_type_id,
      hostUserId: row.host_user_id,
      startAt: row.start_at,
      endAt: row.end_at,
      previousStartAt: row.previous_start_at,
      previousEndAt: row.previous_end_at,
    })

    await enqueueConfiguredBookingReminderOutbox(adminClient, {
      bookingId: row.new_booking_id,
      eventTypeId: row.event_type_id,
      hostUserId: row.host_user_id,
      startAt: row.start_at,
      endAt: row.end_at,
    })
  } catch (sideEffectError) {
    console.error(
      'Error enqueuing post-reschedule side effects (reschedule committed):',
      sideEffectError
    )
  }

  return {
    success: true,
    bookingId: row.new_booking_id,
    previousBookingId: row.old_booking_id,
    cancellationToken: row.cancellation_token,
    rescheduleToken: row.reschedule_token,
    conferenceStatus: row.conference_status,
    conferenceUrl: row.conference_url,
    startAt: row.start_at,
    endAt: row.end_at,
    previousStartAt: row.previous_start_at,
    previousEndAt: row.previous_end_at,
  }
}

function rescheduleErrorMessage(message: string): string {
  if (message.includes('booking_not_found')) {
    return 'Booking not found or cannot be rescheduled'
  }

  if (message.includes('hold_not_found')) {
    return 'Hold not found or already used'
  }

  if (message.includes('hold_expired')) {
    return 'Hold has expired. Please select a new slot.'
  }

  if (message.includes('hold_does_not_match_booking')) {
    return 'Selected slot does not match this booking'
  }

  console.error('Error rescheduling booking:', message)
  return 'Failed to reschedule booking'
}
