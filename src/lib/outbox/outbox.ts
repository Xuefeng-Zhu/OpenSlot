import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database'
import {
  buildReminderOutboxPayload,
  type ReminderOutboxPayload,
} from './reminder-payload'

export type OutboxEventType =
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'booking.rescheduled'
  | 'calendar.write.requested'
  | 'calendar.cancel.requested'
  | 'calendar.reschedule.requested'
  | 'notifications.requested'
  | 'notifications.cancel.requested'
  | 'notifications.reschedule.requested'
  | 'notifications.reminder.requested'
  | 'tenant.webhooks.requested'
  | 'tenant.webhooks.cancel.requested'
  | 'tenant.webhooks.reschedule.requested'

export interface EnqueueOutboxEventInput {
  aggregateType: string
  aggregateId: string
  eventType: OutboxEventType
  payload?: Json
  dedupeKey: string
  availableAt?: string
}

export interface EnqueueOutboxEventsResult {
  queued: number
  duplicates: number
  failed: number
}

export interface BookingOutboxInput {
  bookingId: string
  eventTypeId: string
  hostUserId: string
  startAt: string
  endAt: string
}

export interface BookingCancellationOutboxInput extends BookingOutboxInput {
  cancelReasonProvided: boolean
}

export interface BookingRescheduleOutboxInput extends BookingOutboxInput {
  previousBookingId: string
  previousStartAt: string
  previousEndAt: string
}

export interface BookingReminderPolicy {
  reminderEnabled: boolean
  reminderMinutesBefore: number
  reminderGuestEnabled: boolean
  reminderHostEnabled: boolean
}

interface BookingOutboxPayload {
  [key: string]: Json | undefined
  bookingId: string
  eventTypeId: string
  hostUserId: string
  startAt: string
  endAt: string
}

/**
 * Queues every side effect that should follow a confirmed booking.
 * Each event uses a deterministic dedupe key so retries can safely enqueue the
 * same logical work without sending duplicate emails, calendar writes, or webhooks.
 */
export async function enqueueBookingConfirmedOutbox(
  adminClient: SupabaseClient<Database>,
  booking: BookingOutboxInput
): Promise<EnqueueOutboxEventsResult> {
  const payload = buildBookingPayload(booking)

  return enqueueOutboxEvents(adminClient, [
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'booking.confirmed',
      payload,
      dedupeKey: `booking:${booking.bookingId}:confirmed`,
    },
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'calendar.write.requested',
      payload,
      dedupeKey: `booking:${booking.bookingId}:calendar-write-requested`,
    },
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'notifications.requested',
      payload,
      dedupeKey: `booking:${booking.bookingId}:notifications-requested`,
    },
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'tenant.webhooks.requested',
      payload,
      dedupeKey: `booking:${booking.bookingId}:tenant-webhooks-requested`,
    },
  ])
}

/**
 * Loads the event-type reminder policy and queues a scheduled reminder event
 * for a confirmed booking. Missing or disabled policy data is treated as no-op
 * work so booking confirmation is not blocked by optional reminder setup.
 */
export async function enqueueConfiguredBookingReminderOutbox(
  adminClient: SupabaseClient<Database>,
  booking: BookingOutboxInput
): Promise<EnqueueOutboxEventsResult> {
  const { data, error } = await adminClient
    .from('event_types')
    .select(
      'reminder_enabled, reminder_minutes_before, reminder_guest_enabled, reminder_host_enabled'
    )
    .eq('id', booking.eventTypeId)
    .single()

  if (error || !data) {
    if (error) {
      console.error('Error loading reminder policy:', {
        message: error.message,
        eventTypeId: booking.eventTypeId,
      })
    }

    return emptyOutboxResult()
  }

  return enqueueBookingReminderOutbox(adminClient, booking, {
    reminderEnabled: data.reminder_enabled,
    reminderMinutesBefore: data.reminder_minutes_before,
    reminderGuestEnabled: data.reminder_guest_enabled,
    reminderHostEnabled: data.reminder_host_enabled,
  })
}

/**
 * Queues one pre-meeting reminder for a booking using an outbox available_at
 * timestamp. The deterministic dedupe key keeps retries from scheduling more
 * than one reminder for the same booking.
 */
export async function enqueueBookingReminderOutbox(
  adminClient: SupabaseClient<Database>,
  booking: BookingOutboxInput,
  policy: BookingReminderPolicy
): Promise<EnqueueOutboxEventsResult> {
  if (
    !policy.reminderEnabled ||
    (!policy.reminderGuestEnabled && !policy.reminderHostEnabled)
  ) {
    return emptyOutboxResult()
  }

  let payload: ReminderOutboxPayload
  try {
    payload = buildReminderOutboxPayload({
      ...buildBookingPayload(booking),
      reminderMinutesBefore: policy.reminderMinutesBefore,
      channels: {
        guest: policy.reminderGuestEnabled,
        host: policy.reminderHostEnabled,
      },
    })
  } catch (error) {
    console.error('Invalid reminder outbox payload:', {
      message: error instanceof Error ? error.message : String(error),
      bookingId: booking.bookingId,
      eventTypeId: booking.eventTypeId,
    })
    return emptyOutboxResult()
  }

  const availableAt = new Date(
    new Date(payload.startAt).getTime() -
      payload.reminderMinutesBefore * 60 * 1000
  ).toISOString()

  return enqueueOutboxEvents(adminClient, [
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'notifications.reminder.requested',
      payload,
      dedupeKey: `booking:${booking.bookingId}:notifications-reminder-requested`,
      availableAt,
    },
  ])
}

/**
 * Queues side effects for a booking cancellation.
 * Payloads intentionally stay ID-focused and avoid storing guest PII beyond what
 * later processors can load from server-side tables.
 */
export async function enqueueBookingCancelledOutbox(
  adminClient: SupabaseClient<Database>,
  booking: BookingCancellationOutboxInput
): Promise<EnqueueOutboxEventsResult> {
  const payload = {
    ...buildBookingPayload(booking),
    cancelReasonProvided: booking.cancelReasonProvided,
  }

  return enqueueOutboxEvents(adminClient, [
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'booking.cancelled',
      payload,
      dedupeKey: `booking:${booking.bookingId}:cancelled`,
    },
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'calendar.cancel.requested',
      payload,
      dedupeKey: `booking:${booking.bookingId}:calendar-cancel-requested`,
    },
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'notifications.cancel.requested',
      payload,
      dedupeKey: `booking:${booking.bookingId}:notifications-cancel-requested`,
    },
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'tenant.webhooks.cancel.requested',
      payload,
      dedupeKey: `booking:${booking.bookingId}:tenant-webhooks-cancel-requested`,
    },
  ])
}

/**
 * Queues side effects for a reschedule, preserving both the old and new booking
 * identifiers so processors can cancel stale external events before creating replacements.
 */
export async function enqueueBookingRescheduledOutbox(
  adminClient: SupabaseClient<Database>,
  booking: BookingRescheduleOutboxInput
): Promise<EnqueueOutboxEventsResult> {
  const payload = {
    ...buildBookingPayload(booking),
    previousBookingId: booking.previousBookingId,
    previousStartAt: booking.previousStartAt,
    previousEndAt: booking.previousEndAt,
  }

  return enqueueOutboxEvents(adminClient, [
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'booking.rescheduled',
      payload,
      dedupeKey: `booking:${booking.bookingId}:rescheduled`,
    },
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'calendar.reschedule.requested',
      payload,
      dedupeKey: `booking:${booking.bookingId}:calendar-reschedule-requested`,
    },
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'notifications.reschedule.requested',
      payload,
      dedupeKey: `booking:${booking.bookingId}:notifications-reschedule-requested`,
    },
    {
      aggregateType: 'booking',
      aggregateId: booking.bookingId,
      eventType: 'tenant.webhooks.reschedule.requested',
      payload,
      dedupeKey: `booking:${booking.bookingId}:tenant-webhooks-reschedule-requested`,
    },
  ])
}

/**
 * Inserts outbox rows one at a time and treats unique-key conflicts as duplicates.
 * Returns counts instead of throwing so booking flows can finish even when optional
 * side-effect work has already been queued by a retry.
 */
export async function enqueueOutboxEvents(
  adminClient: SupabaseClient<Database>,
  events: EnqueueOutboxEventInput[]
): Promise<EnqueueOutboxEventsResult> {
  const result: EnqueueOutboxEventsResult = {
    queued: 0,
    duplicates: 0,
    failed: 0,
  }

  for (const event of events) {
    const { error } = await adminClient
      .from('outbox_events')
      .insert({
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId,
        event_type: event.eventType,
        payload: event.payload ?? {},
        dedupe_key: event.dedupeKey,
        available_at: event.availableAt,
      })

    if (!error) {
      result.queued += 1
      continue
    }

    if (error.code === '23505') {
      result.duplicates += 1
      continue
    }

    result.failed += 1
    console.error('Error enqueueing outbox event:', {
      code: error.code,
      message: error.message,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      dedupeKey: event.dedupeKey,
    })
  }

  return result
}

function buildBookingPayload(booking: BookingOutboxInput): BookingOutboxPayload {
  return {
    bookingId: booking.bookingId,
    eventTypeId: booking.eventTypeId,
    hostUserId: booking.hostUserId,
    startAt: booking.startAt,
    endAt: booking.endAt,
  }
}

function emptyOutboxResult(): EnqueueOutboxEventsResult {
  return {
    queued: 0,
    duplicates: 0,
    failed: 0,
  }
}
