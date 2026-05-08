import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/lib/types/database'

type ProviderConnectionRow = Pick<
  Tables<'provider_connections'>,
  | 'id'
  | 'provider'
  | 'account_email'
  | 'status'
  | 'connected_at'
  | 'last_synced_at'
  | 'last_error'
>

type ProviderCalendarRow = Pick<
  Tables<'provider_calendars'>,
  | 'id'
  | 'connection_id'
  | 'external_calendar_id'
  | 'summary'
  | 'timezone'
  | 'is_primary'
  | 'use_for_availability'
  | 'use_for_writes'
>

export interface CalendarConnectionSummary {
  id: string
  provider: string
  accountEmail: string
  status: string
  connectedAt: string
  lastSyncedAt: string | null
  lastError: string | null
  calendars: CalendarSummary[]
}

export interface CalendarSummary {
  id: string
  externalCalendarId: string
  summary: string
  timezone: string | null
  isPrimary: boolean
  useForAvailability: boolean
  useForWrites: boolean
}

export async function listCalendarConnectionSummaries(
  adminClient: SupabaseClient<Database>,
  profileId: string
): Promise<CalendarConnectionSummary[]> {
  const { data: connectionsData, error: connectionsError } = await adminClient
    .from('provider_connections')
    .select('id, provider, account_email, status, connected_at, last_synced_at, last_error')
    .eq('profile_id', profileId)
    .order('connected_at', { ascending: false })

  if (connectionsError) {
    throw new Error(`Failed to load calendar connections: ${connectionsError.message}`)
  }

  const connections = (connectionsData ?? []) as ProviderConnectionRow[]
  const connectionIds = connections.map((connection) => connection.id)

  if (connectionIds.length === 0) {
    return []
  }

  const { data: calendarsData, error: calendarsError } = await adminClient
    .from('provider_calendars')
    .select(
      'id, connection_id, external_calendar_id, summary, timezone, is_primary, use_for_availability, use_for_writes'
    )
    .in('connection_id', connectionIds)
    .order('summary', { ascending: true })

  if (calendarsError) {
    throw new Error(`Failed to load provider calendars: ${calendarsError.message}`)
  }

  const calendarsByConnection = new Map<string, ProviderCalendarRow[]>()

  for (const calendar of (calendarsData ?? []) as ProviderCalendarRow[]) {
    const calendars = calendarsByConnection.get(calendar.connection_id) ?? []
    calendars.push(calendar)
    calendarsByConnection.set(calendar.connection_id, calendars)
  }

  return connections.map((connection) => ({
    id: connection.id,
    provider: connection.provider,
    accountEmail: connection.account_email,
    status: connection.status,
    connectedAt: connection.connected_at,
    lastSyncedAt: connection.last_synced_at,
    lastError: connection.last_error,
    calendars: (calendarsByConnection.get(connection.id) ?? []).map((calendar) => ({
      id: calendar.id,
      externalCalendarId: calendar.external_calendar_id,
      summary: calendar.summary,
      timezone: calendar.timezone,
      isPrimary: calendar.is_primary,
      useForAvailability: calendar.use_for_availability,
      useForWrites: calendar.use_for_writes,
    })),
  }))
}
