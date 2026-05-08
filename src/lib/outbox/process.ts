import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json, Tables } from '@/lib/types/database'
import type { OutboxEventType } from './outbox'
import {
  sendBookingConfirmationToGuest,
  sendBookingNotificationToHost,
  sendCancellationEmail,
  type BookingDetails,
} from '@/lib/email/send'

type OutboxEventRow = Tables<'outbox_events'>
type BookingRow = Tables<'bookings'>

export interface ProcessOutboxBatchOptions {
  adminClient: SupabaseClient<Database>
  limit?: number
  maxAttempts?: number
  handlers?: Partial<Record<OutboxEventType, OutboxEventHandler>>
}

export interface ProcessOutboxBatchResult {
  claimed: number
  completed: number
  failed: number
}

export type OutboxEventHandler = (
  event: OutboxEventRow,
  adminClient: SupabaseClient<Database>
) => Promise<void>

const DEFAULT_LIMIT = 10
const DEFAULT_MAX_ATTEMPTS = 5

export async function processOutboxBatch({
  adminClient,
  limit = DEFAULT_LIMIT,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  handlers = {},
}: ProcessOutboxBatchOptions): Promise<ProcessOutboxBatchResult> {
  const { data: events, error } = await adminClient.rpc('claim_outbox_events', {
    p_limit: limit,
    p_max_attempts: maxAttempts,
  })

  if (error) {
    console.error('Error claiming outbox events:', error)
    return { claimed: 0, completed: 0, failed: 0 }
  }

  const claimed = (events ?? []) as OutboxEventRow[]
  const result: ProcessOutboxBatchResult = {
    claimed: claimed.length,
    completed: 0,
    failed: 0,
  }

  for (const event of claimed) {
    try {
      const handler = handlers[event.event_type as OutboxEventType] ?? defaultHandler
      await handler(event, adminClient)
      await markOutboxEventCompleted(adminClient, event.id)
      result.completed += 1
    } catch (handlerError) {
      await markOutboxEventFailed(adminClient, event, handlerError, maxAttempts)
      result.failed += 1
    }
  }

  return result
}

async function defaultHandler(
  event: OutboxEventRow,
  adminClient: SupabaseClient<Database>
): Promise<void> {
  switch (event.event_type as OutboxEventType) {
    case 'notifications.requested':
      await sendBookingConfirmedNotifications(event, adminClient)
      return
    case 'notifications.cancel.requested':
      await sendBookingCancelledNotifications(event, adminClient)
      return
    case 'booking.confirmed':
    case 'booking.cancelled':
    case 'calendar.write.requested':
    case 'calendar.cancel.requested':
    case 'tenant.webhooks.requested':
    case 'tenant.webhooks.cancel.requested':
      return
    default:
      throw new Error(`Unsupported outbox event type: ${event.event_type}`)
  }
}

async function sendBookingConfirmedNotifications(
  event: OutboxEventRow,
  adminClient: SupabaseClient<Database>
) {
  const bookingDetails = await loadBookingDetails(
    adminClient,
    bookingIdFromPayload(event.payload)
  )

  await sendBookingConfirmationToGuest(bookingDetails)
  await sendBookingNotificationToHost(bookingDetails)
}

async function sendBookingCancelledNotifications(
  event: OutboxEventRow,
  adminClient: SupabaseClient<Database>
) {
  const bookingDetails = await loadBookingDetails(
    adminClient,
    bookingIdFromPayload(event.payload)
  )

  await sendCancellationEmail(bookingDetails, 'guest')
  await sendCancellationEmail(bookingDetails, 'host')
}

async function loadBookingDetails(
  adminClient: SupabaseClient<Database>,
  bookingId: string
): Promise<BookingDetails> {
  const { data: bookingData, error: bookingError } = await adminClient
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (bookingError || !bookingData) {
    throw new Error(`Booking not found for outbox event: ${bookingId}`)
  }

  const booking = bookingData as BookingRow
  const [eventTypeResult, hostProfileResult] = await Promise.all([
    adminClient
      .from('event_types')
      .select('title')
      .eq('id', booking.event_type_id)
      .single(),
    adminClient
      .from('profiles')
      .select('name, email')
      .eq('id', booking.host_user_id)
      .single(),
  ])

  return {
    bookingId: booking.id,
    eventTitle: eventTypeResult.data?.title ?? 'Meeting',
    startAt: booking.start_at,
    endAt: booking.end_at,
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    guestTimezone: booking.guest_timezone,
    hostName: hostProfileResult.data?.name ?? 'Host',
    hostEmail: hostProfileResult.data?.email ?? '',
    cancellationToken: booking.cancellation_token,
  }
}

async function markOutboxEventCompleted(
  adminClient: SupabaseClient<Database>,
  eventId: string
): Promise<void> {
  const { error } = await adminClient
    .from('outbox_events')
    .update({
      status: 'completed',
      processed_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  if (error) {
    console.error('Error completing outbox event:', error)
  }
}

async function markOutboxEventFailed(
  adminClient: SupabaseClient<Database>,
  event: OutboxEventRow,
  error: unknown,
  maxAttempts: number
): Promise<void> {
  const lastError = error instanceof Error ? error.message : String(error)
  const retryDelayMs = retryDelayForAttempt(event.attempts, maxAttempts)
  const availableAt = new Date(Date.now() + retryDelayMs).toISOString()

  const { error: updateError } = await adminClient
    .from('outbox_events')
    .update({
      status: 'failed',
      last_error: lastError,
      available_at: availableAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', event.id)

  if (updateError) {
    console.error('Error failing outbox event:', updateError)
  }
}

function retryDelayForAttempt(attempts: number, maxAttempts: number): number {
  if (attempts >= maxAttempts) {
    return 24 * 60 * 60 * 1000
  }

  const cappedAttempt = Math.min(Math.max(attempts, 1), 6)
  return 2 ** (cappedAttempt - 1) * 60 * 1000
}

function bookingIdFromPayload(payload: Json): string {
  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    typeof payload.bookingId === 'string'
  ) {
    return payload.bookingId
  }

  throw new Error('Outbox event payload is missing bookingId')
}
