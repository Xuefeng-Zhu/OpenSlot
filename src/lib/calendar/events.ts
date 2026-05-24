import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { CalendarProvider } from './oauth'
import type { Database, Json, Tables } from '@/lib/types/database'
import type { OutboxEventType } from '@/lib/outbox/outbox'
import {
  calendarProviderForVideoProvider,
  parseVideoProvider,
  videoProviderLabel,
  type VideoProvider,
} from '@/lib/calendar/video-providers'
import {
  createProviderCalendarEvent,
  deleteProviderCalendarEvent,
  getFreshAccessToken,
  type ProviderCalendarEventInput,
} from './provider-sync'
import { calendarErrorMessage } from './provider-http'

type BookingRow = Tables<'bookings'>
type OutboxEventRow = Tables<'outbox_events'>
type ProviderConnectionRow = Tables<'provider_connections'>
type ProviderCalendarRow = Tables<'provider_calendars'>
type CalendarEventRefRow = Tables<'calendar_event_refs'>

interface CalendarBookingDetails {
  bookingId: string
  hostUserId: string
  eventTypeId: string
  eventTitle: string
  startAt: string
  endAt: string
  guestName: string
  guestEmail: string
  hostName: string
  hostEmail: string
  locationType: string
  locationValue: string
  conferenceProvider: VideoProvider | null
  conferenceStatus: string
  conferenceUrl: string | null
}

/**
 * Dispatches calendar-related outbox events for a booking lifecycle change.
 * Reschedules are handled as cancel-old-then-create-new so external calendars do
 * not retain stale event references when a booking moves.
 */
export async function processCalendarOutboxEvent(
  adminClient: BackendCompatClient<Database>,
  event: OutboxEventRow
): Promise<void> {
  const eventType = event.event_type as OutboxEventType

  if (eventType === 'calendar.write.requested') {
    await createCalendarEventsForBooking(
      adminClient,
      bookingIdFromPayload(event.payload)
    )
    return
  }

  if (eventType === 'calendar.cancel.requested') {
    await cancelCalendarEventsForBooking(
      adminClient,
      bookingIdFromPayload(event.payload)
    )
    return
  }

  if (eventType === 'calendar.reschedule.requested') {
    const previousBookingId = previousBookingIdFromPayload(event.payload)
    if (previousBookingId) {
      await cancelCalendarEventsForBooking(adminClient, previousBookingId)
    }
    await createCalendarEventsForBooking(
      adminClient,
      bookingIdFromPayload(event.payload)
    )
    return
  }

  throw new Error(`Unsupported calendar outbox event: ${event.event_type}`)
}

/**
 * Creates provider events for every calendar the host has enabled for writes.
 * Existing active refs are skipped to make retries idempotent after a successful
 * provider write has already been recorded.
 */
export async function createCalendarEventsForBooking(
  adminClient: BackendCompatClient<Database>,
  bookingId: string
): Promise<{ created: number; skipped: number }> {
  const booking = await loadCalendarBookingDetails(adminClient, bookingId)
  const writeTargets = await loadCalendarWriteTargets(
    adminClient,
    booking.hostUserId
  )
  const targets = calendarTargetsForBooking(booking, writeTargets)
  const result = { created: 0, skipped: 0 }

  if (booking.conferenceProvider && targets.length === 0) {
    const message = `No writable ${videoProviderLabel(
      booking.conferenceProvider
    )} calendar connection is available`
    await updateBookingConference(adminClient, booking.bookingId, {
      status: 'setup_required',
      error: message,
    })
    throw new Error(message)
  }

  for (const target of targets) {
    const existingRef = await loadActiveCalendarRef(
      adminClient,
      booking.bookingId,
      target.calendar.id
    )

    if (existingRef) {
      if (booking.conferenceProvider) {
        const conferenceUrl = conferenceUrlFromMetadata(existingRef.metadata)
        if (conferenceUrl) {
          await updateBookingConference(adminClient, booking.bookingId, {
            status: 'ready',
            url: conferenceUrl,
            error: null,
          })
        }
      }
      result.skipped += 1
      continue
    }

    const accessToken = await getFreshAccessToken(
      adminClient,
      target.connection
    )
    let providerEvent: Awaited<ReturnType<typeof createProviderCalendarEvent>>

    try {
      providerEvent = await createProviderCalendarEvent({
        provider: target.connection.provider as CalendarProvider,
        accessToken,
        externalCalendarId: target.calendar.external_calendar_id,
        event: providerEventFromBooking(booking),
      })
    } catch (error) {
      if (booking.conferenceProvider) {
        await updateBookingConference(adminClient, booking.bookingId, {
          status: 'failed',
          error: calendarErrorMessage(error),
        })
      }
      throw error
    }

    if (booking.conferenceProvider && !providerEvent.conferenceUrl) {
      const message = `${videoProviderLabel(
        booking.conferenceProvider
      )} did not return a conference link`
      await updateBookingConference(adminClient, booking.bookingId, {
        status: 'failed',
        error: message,
      })
      throw new Error(message)
    }

    const { error } = await adminClient
      .from('calendar_event_refs')
      .upsert(
        {
          booking_id: booking.bookingId,
          provider_calendar_id: target.calendar.id,
          external_event_id: providerEvent.externalEventId,
          provider_event_url: providerEvent.providerEventUrl,
          status: 'active',
          last_synced_at: new Date().toISOString(),
          last_error: null,
          metadata: {
            ...jsonObject(providerEvent.metadata),
            provider: target.connection.provider,
            connectionId: target.connection.id,
            conferenceProvider: booking.conferenceProvider,
            conferenceUrl: providerEvent.conferenceUrl,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'provider_calendar_id,booking_id' }
      )

    if (error) {
      throw new Error(`Failed to store calendar event reference: ${error.message}`)
    }

    if (booking.conferenceProvider && providerEvent.conferenceUrl) {
      await updateBookingConference(adminClient, booking.bookingId, {
        status: 'ready',
        url: providerEvent.conferenceUrl,
        error: null,
      })
    }

    result.created += 1
  }

  return result
}

/**
 * Cancels all active provider event references for a booking.
 * Each ref is marked cancelled only after the provider delete succeeds or the
 * provider reports the event is already gone.
 */
export async function cancelCalendarEventsForBooking(
  adminClient: BackendCompatClient<Database>,
  bookingId: string
): Promise<{ cancelled: number }> {
  const { data, error } = await adminClient
    .from('calendar_event_refs')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('status', 'active')

  if (error) {
    throw new Error(`Failed to load calendar event references: ${error.message}`)
  }

  const refs = (data ?? []) as CalendarEventRefRow[]
  let cancelled = 0

  for (const ref of refs) {
    const target = await loadCalendarTargetByCalendarId(
      adminClient,
      ref.provider_calendar_id
    )
    const accessToken = await getFreshAccessToken(adminClient, target.connection)

    try {
      await deleteProviderCalendarEvent({
        provider: target.connection.provider as CalendarProvider,
        accessToken,
        externalCalendarId: target.calendar.external_calendar_id,
        externalEventId: ref.external_event_id,
      })
      await adminClient
        .from('calendar_event_refs')
        .update({
          status: 'cancelled',
          last_synced_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ref.id)
      cancelled += 1
    } catch (error) {
      await adminClient
        .from('calendar_event_refs')
        .update({
          last_error: calendarErrorMessage(error),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ref.id)
      throw error
    }
  }

  return { cancelled }
}

async function loadCalendarBookingDetails(
  adminClient: BackendCompatClient<Database>,
  bookingId: string
): Promise<CalendarBookingDetails> {
  const { data, error } = await adminClient
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (error || !data) {
    throw new Error(`Booking not found for calendar sync: ${bookingId}`)
  }

  const booking = data as BookingRow
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
    hostUserId: booking.host_user_id,
    eventTypeId: booking.event_type_id,
    eventTitle: eventTypeResult.data?.title ?? 'Meeting',
    startAt: booking.start_at,
    endAt: booking.end_at,
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    hostName: hostProfileResult.data?.name ?? 'Host',
    hostEmail: hostProfileResult.data?.email ?? '',
    locationType: booking.location_type,
    locationValue: booking.location_value,
    conferenceProvider: parseVideoProvider(booking.conference_provider),
    conferenceStatus: booking.conference_status,
    conferenceUrl: booking.conference_url,
  }
}

async function loadCalendarWriteTargets(
  adminClient: BackendCompatClient<Database>,
  profileId: string
) {
  const { data: connectionsData, error: connectionsError } = await adminClient
    .from('provider_connections')
    .select('*')
    .eq('profile_id', profileId)
    .eq('status', 'active')

  if (connectionsError) {
    throw new Error(`Failed to load calendar connections: ${connectionsError.message}`)
  }

  const connections = (connectionsData ?? []) as ProviderConnectionRow[]
  const targets: Array<{
    connection: ProviderConnectionRow
    calendar: ProviderCalendarRow
  }> = []

  for (const connection of connections) {
    const { data: calendarsData, error: calendarsError } = await adminClient
      .from('provider_calendars')
      .select('*')
      .eq('connection_id', connection.id)
      .eq('use_for_writes', true)

    if (calendarsError) {
      throw new Error(`Failed to load writable calendars: ${calendarsError.message}`)
    }

    for (const calendar of (calendarsData ?? []) as ProviderCalendarRow[]) {
      targets.push({ connection, calendar })
    }
  }

  return targets
}

async function loadCalendarTargetByCalendarId(
  adminClient: BackendCompatClient<Database>,
  providerCalendarId: string
) {
  const { data: calendarData, error: calendarError } = await adminClient
    .from('provider_calendars')
    .select('*')
    .eq('id', providerCalendarId)
    .single()

  if (calendarError || !calendarData) {
    throw new Error(`Provider calendar not found: ${providerCalendarId}`)
  }

  const calendar = calendarData as ProviderCalendarRow
  const { data: connectionData, error: connectionError } = await adminClient
    .from('provider_connections')
    .select('*')
    .eq('id', calendar.connection_id)
    .single()

  if (connectionError || !connectionData) {
    throw new Error(`Provider connection not found: ${calendar.connection_id}`)
  }

  return {
    calendar,
    connection: connectionData as ProviderConnectionRow,
  }
}

async function loadActiveCalendarRef(
  adminClient: BackendCompatClient<Database>,
  bookingId: string,
  providerCalendarId: string
): Promise<CalendarEventRefRow | null> {
  const { data, error } = await adminClient
    .from('calendar_event_refs')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('provider_calendar_id', providerCalendarId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load calendar event reference: ${error.message}`)
  }

  return (data as CalendarEventRefRow | null) ?? null
}

function providerEventFromBooking(
  booking: CalendarBookingDetails
): ProviderCalendarEventInput {
  return {
    bookingId: booking.bookingId,
    title: booking.eventTitle,
    description: [
      `Booked through OpenSlot.`,
      `Guest: ${booking.guestName} <${booking.guestEmail}>`,
      booking.hostEmail
        ? `Host: ${booking.hostName} <${booking.hostEmail}>`
        : `Host: ${booking.hostName}`,
    ].join('\n'),
    startAt: booking.startAt,
    endAt: booking.endAt,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    conferenceProvider: booking.conferenceProvider,
  }
}

function calendarTargetsForBooking(
  booking: CalendarBookingDetails,
  writeTargets: Array<{
    connection: ProviderConnectionRow
    calendar: ProviderCalendarRow
  }>
) {
  if (!booking.conferenceProvider) {
    return writeTargets
  }

  const provider = calendarProviderForVideoProvider(booking.conferenceProvider)
  return writeTargets
    .filter((target) => target.connection.provider === provider)
    .slice(0, 1)
}

async function updateBookingConference(
  adminClient: BackendCompatClient<Database>,
  bookingId: string,
  update: {
    status: 'ready' | 'setup_required' | 'failed'
    url?: string | null
    error?: string | null
  }
): Promise<void> {
  const { error } = await adminClient
    .from('bookings')
    .update({
      conference_status: update.status,
      conference_url: update.url ?? null,
      conference_error: update.error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (error) {
    throw new Error(`Failed to update booking conference status: ${error.message}`)
  }
}

function conferenceUrlFromMetadata(metadata: Json): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }

  return typeof metadata.conferenceUrl === 'string'
    ? metadata.conferenceUrl
    : null
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

  throw new Error('Calendar outbox payload is missing bookingId')
}

function previousBookingIdFromPayload(payload: Json): string | null {
  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    typeof payload.previousBookingId === 'string'
  ) {
    return payload.previousBookingId
  }

  return null
}

function jsonObject(value: Json): { [key: string]: Json | undefined } {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}
