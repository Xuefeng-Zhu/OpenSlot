import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalendarProvider } from './oauth'
import type { Database, Json, Tables } from '@/lib/types/database'
import {
  getFreshAccessToken,
  listProviderBusyEvents,
} from './provider-sync'

type ProviderConnectionRow = Tables<'provider_connections'>
type ProviderCalendarRow = Pick<
  Tables<'provider_calendars'>,
  'id' | 'connection_id' | 'external_calendar_id' | 'timezone'
>
type ProviderWatchRow = Pick<
  Tables<'provider_watches'>,
  | 'connection_id'
  | 'external_calendar_id'
  | 'status'
  | 'expiration_at'
  | 'metadata'
>

export type FinalProviderAvailabilityResult =
  | { success: true; checked: boolean; reason: 'disabled' | 'fresh' | 'no_calendars' | 'verified' }
  | { success: false; status: 409 | 503; error: string }

/**
 * Performs an optional final live provider availability check before booking
 * confirmation when cached calendar/watch health is stale.
 */
export async function verifyFinalProviderAvailability(
  adminClient: SupabaseClient<Database>,
  {
    hostUserId,
    startAt,
    endAt,
    bufferBeforeMinutes,
    bufferAfterMinutes,
  }: {
    hostUserId: string
    startAt: string
    endAt: string
    bufferBeforeMinutes: number
    bufferAfterMinutes: number
  },
  fetchImpl: typeof fetch = fetch
): Promise<FinalProviderAvailabilityResult> {
  if (process.env.CALENDAR_FINAL_AVAILABILITY_CHECK !== 'stale') {
    return { success: true, checked: false, reason: 'disabled' }
  }

  const connections = await loadProviderConnections(adminClient, hostUserId)

  if (connections.length === 0) {
    return { success: true, checked: false, reason: 'no_calendars' }
  }

  const calendars = await loadAvailabilityCalendars(
    adminClient,
    connections.map((connection) => connection.id)
  )

  if (calendars.length === 0) {
    return { success: true, checked: false, reason: 'no_calendars' }
  }

  const watches = await loadProviderWatches(
    adminClient,
    connections.map((connection) => connection.id)
  )

  if (!isCalendarHealthStale(connections, calendars, watches)) {
    return { success: true, checked: false, reason: 'fresh' }
  }

  const paddedStart = new Date(
    new Date(startAt).getTime() - bufferBeforeMinutes * 60 * 1000
  ).toISOString()
  const paddedEnd = new Date(
    new Date(endAt).getTime() + bufferAfterMinutes * 60 * 1000
  ).toISOString()
  const calendarsByConnection = groupByConnection(calendars)

  try {
    for (const connection of connections) {
      const accessToken = await getFreshAccessToken(
        adminClient,
        connection,
        fetchImpl
      )
      const provider = connection.provider as CalendarProvider

      for (const calendar of calendarsByConnection.get(connection.id) ?? []) {
        const busyEvents = await listProviderBusyEvents({
          provider,
          accessToken,
          externalCalendarId: calendar.external_calendar_id,
          calendarTimezone: calendar.timezone ?? 'UTC',
          windowStart: paddedStart,
          windowEnd: paddedEnd,
          fetchImpl,
        })

        if (
          busyEvents.some((event) =>
            rangesOverlap(paddedStart, paddedEnd, event.startAt, event.endAt)
          )
        ) {
          return {
            success: false,
            status: 409,
            error:
              'This slot conflicts with a connected calendar event. Please select a different time.',
          }
        }
      }
    }
  } catch (error) {
    console.error('Final provider availability check failed:', error)
    return {
      success: false,
      status: 503,
      error:
        'Could not verify connected calendar availability. Please try again.',
    }
  }

  return { success: true, checked: true, reason: 'verified' }
}

async function loadProviderConnections(
  adminClient: SupabaseClient<Database>,
  hostUserId: string
): Promise<ProviderConnectionRow[]> {
  const { data, error } = await adminClient
    .from('provider_connections')
    .select('*')
    .eq('profile_id', hostUserId)
    .in('status', ['active', 'error'])

  if (error) {
    throw new Error(`Failed to load calendar connections: ${error.message}`)
  }

  return (data ?? []) as ProviderConnectionRow[]
}

async function loadAvailabilityCalendars(
  adminClient: SupabaseClient<Database>,
  connectionIds: string[]
): Promise<ProviderCalendarRow[]> {
  const { data, error } = await adminClient
    .from('provider_calendars')
    .select('id, connection_id, external_calendar_id, timezone')
    .in('connection_id', connectionIds)
    .eq('use_for_availability', true)

  if (error) {
    throw new Error(`Failed to load availability calendars: ${error.message}`)
  }

  return (data ?? []) as ProviderCalendarRow[]
}

async function loadProviderWatches(
  adminClient: SupabaseClient<Database>,
  connectionIds: string[]
): Promise<ProviderWatchRow[]> {
  const { data, error } = await adminClient
    .from('provider_watches')
    .select('connection_id, external_calendar_id, status, expiration_at, metadata')
    .in('connection_id', connectionIds)

  if (error) {
    throw new Error(`Failed to load provider watches: ${error.message}`)
  }

  return (data ?? []) as ProviderWatchRow[]
}

function isCalendarHealthStale(
  connections: ProviderConnectionRow[],
  calendars: ProviderCalendarRow[],
  watches: ProviderWatchRow[]
): boolean {
  const now = Date.now()
  const staleAfterMs = staleAfterMinutes() * 60 * 1000
  const connectionById = new Map(
    connections.map((connection) => [connection.id, connection])
  )
  const watchByCalendar = new Map(
    watches.map((watch) => [watchKey(watch.connection_id, watch.external_calendar_id), watch])
  )

  return calendars.some((calendar) => {
    const connection = connectionById.get(calendar.connection_id)

    if (!connection || connection.status !== 'active') {
      return true
    }

    if (isTimestampStale(connection.last_synced_at, now, staleAfterMs)) {
      return true
    }

    const watch = watchByCalendar.get(
      watchKey(calendar.connection_id, calendar.external_calendar_id)
    )

    if (!watch || watch.status !== 'active') {
      return true
    }

    if (!hasWatchValidationSecret(watch.metadata)) {
      return true
    }

    return !watch.expiration_at || new Date(watch.expiration_at).getTime() <= now
  })
}

function hasWatchValidationSecret(metadata: Json): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false
  }

  const value = metadata as Record<string, Json>
  return (
    typeof value.tokenHash === 'string' ||
    typeof value.clientStateHash === 'string'
  )
}

function isTimestampStale(
  value: string | null,
  nowMs: number,
  staleAfterMs: number
): boolean {
  if (!value) {
    return true
  }

  const timestamp = new Date(value).getTime()
  return !Number.isFinite(timestamp) || nowMs - timestamp > staleAfterMs
}

function staleAfterMinutes(): number {
  const value = Number(process.env.CALENDAR_STALE_AFTER_MINUTES)
  return Number.isFinite(value) && value > 0 ? value : 10
}

function groupByConnection(
  calendars: ProviderCalendarRow[]
): Map<string, ProviderCalendarRow[]> {
  const grouped = new Map<string, ProviderCalendarRow[]>()

  for (const calendar of calendars) {
    const items = grouped.get(calendar.connection_id) ?? []
    items.push(calendar)
    grouped.set(calendar.connection_id, items)
  }

  return grouped
}

function watchKey(connectionId: string, externalCalendarId: string): string {
  return `${connectionId}:${externalCalendarId}`
}

function rangesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
): boolean {
  return new Date(leftStart) < new Date(rightEnd) && new Date(leftEnd) > new Date(rightStart)
}
