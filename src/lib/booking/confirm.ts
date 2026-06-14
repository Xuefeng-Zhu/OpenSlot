import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database, Json } from '@/lib/types/database'
import type { ConfirmBookingInput, ConfirmBookingResult } from './types'
import {
  normalizeInviteeQuestions,
  parseInviteeAnswers,
} from '@/lib/validations/invitee-questions'
import { upsertContactFromBooking } from '@/lib/contacts/contacts'
import { verifyFinalProviderAvailability } from '@/lib/calendar/final-availability'
import { expireHoldReservation } from '@/lib/reservations/host-reservations'

type ConfirmRpcRow = {
  booking_id: string
  cancellation_token: string
  reschedule_token: string
  conference_status: string
  conference_url: string | null
}

/**
 * Confirms a booking from an active hold.
 *
 * The atomic `confirm_booking` RPC performs the booking row insert, hold
 * status update, host reservation conversion, `booking_events` append, and
 * `outbox_events` enqueue in a single database transaction. This function
 * performs only the pre-RPC validation (hold fetch, answer validation,
 * optional final provider availability check) and the best-effort post-RPC
 * contact upsert.
 */
export async function confirmBooking(
  input: ConfirmBookingInput,
  adminClient: BackendCompatClient<Database>
): Promise<ConfirmBookingResult> {
  const { holdToken, guestName, guestEmail, guestTimezone, notes, answers } = input;

  // Fetch the hold and short-circuit on missing/already-used.
  const { data: hold, error: holdError } = await adminClient
    .from('slot_holds').select('*').eq('hold_token', holdToken).eq('status', 'active').single();
  if (holdError || !hold) return { success: false, error: 'Hold not found or already used' };

  // Lazy expiry fast path: if the hold expired between fetch and RPC, mark
  // it expired locally so the RPC short-circuits with `hold_already_used`.
  if (new Date(hold.expires_at) < new Date()) {
    await adminClient.from('slot_holds').update({ status: 'expired' }).eq('id', hold.id);
    await expireHoldReservation(adminClient, hold.id);
    return { success: false, error: 'Hold has expired. Please select a new slot.' };
  }

  // Read the event_type fields the lib still needs (answer validation +
  // final availability buffer math). The RPC reads everything else.
  const { data: eventTypeData, error: eventTypeError } = await adminClient
    .from('event_types')
    .select('invitee_questions, buffer_before_minutes, buffer_after_minutes')
    .eq('id', hold.event_type_id).single();
  if (eventTypeError || !eventTypeData) {
    return { success: false, error: 'Failed to load event type.' };
  }

  const parsedAnswers = parseInviteeAnswers(
    normalizeInviteeQuestions(eventTypeData.invitee_questions),
    answers ?? {}
  );
  if (!parsedAnswers.success) return { success: false, error: 'Booking answers validation failed.' };

  // Final provider availability check (moved before the RPC).
  const finalAvailability = await verifyFinalProviderAvailability(adminClient, {
    hostUserId: hold.host_user_id,
    startAt: hold.start_at,
    endAt: hold.end_at,
    bufferBeforeMinutes: eventTypeData.buffer_before_minutes,
    bufferAfterMinutes: eventTypeData.buffer_after_minutes,
  });
  if (!finalAvailability.success) return { success: false, error: finalAvailability.error };

  // Atomic confirm RPC: booking insert + hold flip + reservation convert +
  // booking_events + outbox_events all in one transaction.
  const { data: rpcRow, error: rpcError } = await adminClient.rpc('confirm_booking', {
    p_hold_token: holdToken,
    p_guest_name: guestName,
    p_guest_email: guestEmail,
    p_guest_timezone: guestTimezone,
    p_notes: notes ?? '',
    p_booking_answers: parsedAnswers.data as Json,
  }).single<ConfirmRpcRow>();
  if (rpcError || !rpcRow) return { success: false, error: confirmRpcErrorMessage(rpcError) };

  // Best-effort post-RPC contact sync. Failures must not undo the booking.
  await upsertContactFromBooking(adminClient, {
    bookingId: rpcRow.booking_id,
    hostUserId: hold.host_user_id,
    guestName,
    guestEmail,
    guestTimezone,
  });

  return {
    success: true,
    bookingId: rpcRow.booking_id,
    cancellationToken: rpcRow.cancellation_token,
    rescheduleToken: rpcRow.reschedule_token,
    conferenceStatus: rpcRow.conference_status,
    conferenceUrl: rpcRow.conference_url,
  };
}

function confirmRpcErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return 'Failed to create booking.';
  if (error.code === '23P01') {
    return 'This slot has been booked by someone else. Please select a different time.';
  }
  const message = error.message ?? '';
  if (message.includes('hold_not_found') || message.includes('hold_already_used')) {
    return 'Hold not found or already used';
  }
  if (message.includes('hold_expired')) {
    return 'Hold has expired. Please select a new slot.';
  }
  if (message.includes('event_type_not_found')) {
    return 'Failed to load event type.';
  }
  console.error('Error confirming booking through backend function:', {
    code: error.code,
    message: error.message,
  });
  return 'Failed to create booking.';
}
