import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database, Json, Tables } from '@/lib/types/database'
import type { OutboxEventType } from './outbox'
import {
  sendBookingConfirmationToGuest,
  sendBookingNotificationToHost,
  sendBookingReminderEmail,
  sendCancellationEmail,
  type BookingDetails,
} from '@/lib/email/send'
import { processCalendarOutboxEvent } from '@/lib/calendar/events'
import { enqueueWebhookDeliveriesForOutboxEvent } from '@/lib/webhooks/deliveries'
import { normalizeBookingAnswerSummaries } from '@/lib/validations/invitee-questions'
import { parseReminderOutboxPayload } from './reminder-payload'
import { normalizeDashboardDisplayPreferences } from '@/lib/dashboard/display-preferences'

type OutboxEventRow = Tables<'outbox_events'>
type BookingRow = Tables<'bookings'>
type HostNotificationPreferences = Pick<
  Tables<'user_settings'>,
  'notify_new_booking' | 'notify_cancellation' | 'notify_reminder'
>
type LoadedBookingDetails = BookingDetails &
  Pick<BookingRow, 'status'> & {
    hostNotificationPreferences: HostNotificationPreferences
  }

export interface ProcessOutboxBatchOptions {
  adminClient: BackendCompatClient<Database>
  limit?: number
  maxAttempts?: number
  handlers?: Partial<Record<OutboxEventType, OutboxEventHandler>>
}

export interface ProcessOutboxBatchResult {
  claimed: number
  completed: number
  deferred: number
  failed: number
}

export type OutboxEventHandler = (
  event: OutboxEventRow,
  adminClient: BackendCompatClient<Database>
) => Promise<void>

const DEFAULT_LIMIT = 10
const DEFAULT_MAX_ATTEMPTS = 5

/**
 * Claims and processes a batch of due outbox events.
 * The claiming RPC is responsible for concurrency control; this worker runs each
 * event handler, records completion, and schedules retry metadata for failures.
 */
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
    return { claimed: 0, completed: 0, deferred: 0, failed: 0 }
  }

  const claimed = (events ?? []) as OutboxEventRow[]
  const result: ProcessOutboxBatchResult = {
    claimed: claimed.length,
    completed: 0,
    deferred: 0,
    failed: 0,
  }

  for (const event of claimed) {
    try {
      const handler = handlers[event.event_type as OutboxEventType] ?? defaultHandler
      await handler(event, adminClient)
      await markOutboxEventCompleted(adminClient, event.id)
      result.completed += 1
    } catch (handlerError) {
      if (handlerError instanceof DeferredOutboxEventError) {
        await markOutboxEventDeferred(adminClient, event, handlerError)
        result.deferred += 1
      } else {
        await markOutboxEventFailed(adminClient, event, handlerError, maxAttempts)
        result.failed += 1
      }
    }
  }

  return result
}

/**
 * Routes outbox events to their side-effect handlers.
 * Domain lifecycle events are intentionally no-ops here because their role is to
 * act as durable facts for downstream consumers, not to trigger direct work.
 */
async function defaultHandler(
  event: OutboxEventRow,
  adminClient: BackendCompatClient<Database>
): Promise<void> {
  switch (event.event_type as OutboxEventType) {
    case 'notifications.requested':
      await sendBookingConfirmedNotifications(event, adminClient)
      return
    case 'notifications.cancel.requested':
      await sendBookingCancelledNotifications(event, adminClient)
      return
    case 'notifications.reschedule.requested':
      await sendBookingRescheduledNotifications(event, adminClient)
      return
    case 'notifications.reminder.requested':
      await sendBookingReminderNotifications(event, adminClient)
      return
    case 'calendar.write.requested':
    case 'calendar.cancel.requested':
    case 'calendar.reschedule.requested':
      await processCalendarOutboxEvent(adminClient, event)
      return
    case 'booking.confirmed':
    case 'booking.cancelled':
    case 'booking.rescheduled':
      return
    case 'tenant.webhooks.requested':
    case 'tenant.webhooks.cancel.requested':
    case 'tenant.webhooks.reschedule.requested':
      await enqueueWebhookDeliveriesForOutboxEvent(adminClient, event)
      return
    default:
      throw new Error(`Unsupported outbox event type: ${event.event_type}`)
  }
}

async function sendBookingConfirmedNotifications(
  event: OutboxEventRow,
  adminClient: BackendCompatClient<Database>
) {
  const bookingDetails = await loadBookingDetails(
    adminClient,
    bookingIdFromPayload(event.payload),
    { requireReadyConference: true }
  )

  await sendBookingConfirmationToGuest(bookingDetails)
  if (bookingDetails.hostNotificationPreferences.notify_new_booking) {
    await sendBookingNotificationToHost(bookingDetails)
  }
}

async function sendBookingCancelledNotifications(
  event: OutboxEventRow,
  adminClient: BackendCompatClient<Database>
) {
  const bookingDetails = await loadBookingDetails(
    adminClient,
    bookingIdFromPayload(event.payload),
    { requireReadyConference: false }
  )

  await sendCancellationEmail(bookingDetails, 'guest')
  if (bookingDetails.hostNotificationPreferences.notify_cancellation) {
    await sendCancellationEmail(bookingDetails, 'host')
  }
}

async function sendBookingRescheduledNotifications(
  event: OutboxEventRow,
  adminClient: BackendCompatClient<Database>
) {
  const bookingDetails = await loadBookingDetails(
    adminClient,
    bookingIdFromPayload(event.payload),
    { requireReadyConference: true }
  )

  await sendBookingConfirmationToGuest(bookingDetails)
  if (bookingDetails.hostNotificationPreferences.notify_new_booking) {
    await sendBookingNotificationToHost(bookingDetails)
  }
}

async function sendBookingReminderNotifications(
  event: OutboxEventRow,
  adminClient: BackendCompatClient<Database>
) {
  const reminderRequest = parseReminderOutboxPayload(event.payload)
  const bookingDetails = await loadBookingDetails(
    adminClient,
    reminderRequest.bookingId,
    { requireReadyConference: true }
  )

  if (
    bookingDetails.status !== 'confirmed' ||
    bookingDetails.startAt !== reminderRequest.startAt ||
    bookingDetails.endAt !== reminderRequest.endAt
  ) {
    return
  }

  if (reminderRequest.channels.guest) {
    await sendBookingReminderEmail(
      bookingDetails,
      'guest',
      reminderRequest.reminderMinutesBefore
    )
  }

  if (
    reminderRequest.channels.host &&
    bookingDetails.hostNotificationPreferences.notify_reminder
  ) {
    await sendBookingReminderEmail(
      bookingDetails,
      'host',
      reminderRequest.reminderMinutesBefore
    )
  }
}

async function loadBookingDetails(
  adminClient: BackendCompatClient<Database>,
  bookingId: string,
  options: { requireReadyConference: boolean }
): Promise<LoadedBookingDetails> {
  const { data: bookingData, error: bookingError } = await adminClient
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (bookingError || !bookingData) {
    throw new Error(`Booking not found for outbox event: ${bookingId}`)
  }

  const booking = bookingData as BookingRow

  if (
    options.requireReadyConference &&
    booking.conference_provider &&
    booking.conference_status !== 'ready'
  ) {
    throw new ConferenceLinkPendingError(
      bookingId,
      booking.conference_status ?? 'pending'
    )
  }

  const [eventTypeResult, hostProfileResult, userSettingsResult] =
    await Promise.all([
      adminClient
        .from('event_types')
        .select('title')
        .eq('id', booking.event_type_id)
        .single(),
      adminClient
        .from('profiles')
        .select('name, email, default_timezone')
        .eq('id', booking.host_user_id)
        .single(),
      adminClient
        .from('user_settings')
        .select(
          'date_format, time_format, notify_new_booking, notify_cancellation, notify_reminder'
        )
        .eq('profile_id', booking.host_user_id)
        .maybeSingle(),
    ])

  if (eventTypeResult.error || !eventTypeResult.data) {
    throw new Error('Failed to load event type for booking notification')
  }

  if (hostProfileResult.error || !hostProfileResult.data) {
    throw new Error('Failed to load host profile for booking notification')
  }

  if (userSettingsResult.error) {
    throw new Error('Failed to load host notification preferences')
  }

  const userSettings = userSettingsResult.data as Pick<
    Tables<'user_settings'>,
    | 'date_format'
    | 'time_format'
    | 'notify_new_booking'
    | 'notify_cancellation'
    | 'notify_reminder'
  > | null
  const hostProfile = hostProfileResult.data as Pick<
    Tables<'profiles'>,
    'name' | 'email' | 'default_timezone'
  >

  return {
    bookingId: booking.id,
    eventTitle: eventTypeResult.data.title,
    startAt: booking.start_at,
    endAt: booking.end_at,
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    guestTimezone: booking.guest_timezone,
    hostName: hostProfile.name,
    hostEmail: hostProfile.email,
    hostDisplayPreferences: normalizeDashboardDisplayPreferences({
      timezone: hostProfile?.default_timezone,
      dateFormat: userSettings?.date_format,
      timeFormat: userSettings?.time_format,
    }),
    hostNotificationPreferences: {
      notify_new_booking: userSettings?.notify_new_booking ?? true,
      notify_cancellation: userSettings?.notify_cancellation ?? true,
      notify_reminder: userSettings?.notify_reminder ?? true,
    },
    locationType: booking.location_type,
    locationValue: booking.location_value,
    conferenceProvider: booking.conference_provider,
    conferenceUrl: booking.conference_url,
    conferenceStatus: booking.conference_status,
    bookingAnswers: normalizeBookingAnswerSummaries(booking.booking_answers),
    cancellationToken: booking.cancellation_token,
    rescheduleToken: booking.reschedule_token,
    status: booking.status,
  }
}

class DeferredOutboxEventError extends Error {
  constructor(message: string, readonly retryDelayMs = 60_000) {
    super(message)
    this.name = 'DeferredOutboxEventError'
  }
}

class ConferenceLinkPendingError extends DeferredOutboxEventError {
  constructor(bookingId: string, status: string) {
    super(`Conference link is not ready for booking ${bookingId}: ${status}`)
    this.name = 'ConferenceLinkPendingError'
  }
}

async function markOutboxEventCompleted(
  adminClient: BackendCompatClient<Database>,
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
  adminClient: BackendCompatClient<Database>,
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

/**
 * Reschedules expected wait states without consuming the retry budget that is
 * reserved for actual handler failures. The claim RPC already increments
 * attempts, so this writes the count back down while the event waits.
 */
async function markOutboxEventDeferred(
  adminClient: BackendCompatClient<Database>,
  event: OutboxEventRow,
  error: DeferredOutboxEventError
): Promise<void> {
  const availableAt = new Date(Date.now() + error.retryDelayMs).toISOString()

  const { error: updateError } = await adminClient
    .from('outbox_events')
    .update({
      status: 'pending',
      attempts: Math.max(event.attempts - 1, 0),
      last_error: error.message,
      available_at: availableAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', event.id)

  if (updateError) {
    console.error('Error deferring outbox event:', updateError)
  }
}

/**
 * Computes exponential retry delays in minutes and backs off terminal failures
 * to a daily retry cadence so persistent provider issues do not hot-loop.
 */
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
