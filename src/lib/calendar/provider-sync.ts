import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalendarProvider } from './oauth'
import type { Database, Json, Tables } from '@/lib/types/database'
import { decryptToken, encryptToken } from '@/lib/security/token-encryption'
import { refreshCalendarAccessToken } from './oauth'

type ProviderConnectionRow = Tables<'provider_connections'>
type ProviderCalendarRow = Tables<'provider_calendars'>

export interface SyncCalendarConnectionsResult {
  checked: number
  synced: number
  failed: number
}

export interface ProviderCalendarEventInput {
  bookingId: string
  title: string
  description: string
  startAt: string
  endAt: string
  guestName: string
  guestEmail: string
}

export interface ProviderCalendarEventResult {
  externalEventId: string
  providerEventUrl: string | null
  metadata: Json
}

interface ProviderCalendarSummary {
  externalCalendarId: string
  summary: string
  timezone: string | null
  isPrimary: boolean
  canWrite: boolean
  metadata: Json
}

interface ProviderBusyEvent {
  sourceEventId: string
  startAt: string
  endAt: string
  transparency: string
  etag: string | null
  metadata: Json
}

interface GoogleCalendarListResponse {
  items?: Array<{
    id?: string
    summary?: string
    timeZone?: string
    primary?: boolean
    accessRole?: string
    deleted?: boolean
  }>
  nextPageToken?: string
}

interface GoogleEventsResponse {
  items?: Array<{
    id?: string
    status?: string
    transparency?: string
    etag?: string
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
  }>
  nextPageToken?: string
}

interface GoogleEventResponse {
  id?: string
  htmlLink?: string
  etag?: string
}

interface MicrosoftCalendarViewResponse {
  value?: Array<{
    id?: string
    showAs?: string
    changeKey?: string
    start?: { dateTime?: string; timeZone?: string }
    end?: { dateTime?: string; timeZone?: string }
  }>
  '@odata.nextLink'?: string
}

interface MicrosoftCalendarListResponse {
  value?: Array<{
    id?: string
    name?: string
    isDefaultCalendar?: boolean
    canEdit?: boolean
  }>
  '@odata.nextLink'?: string
}

interface MicrosoftEventResponse {
  id?: string
  webLink?: string
  changeKey?: string
}

const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000

export async function syncActiveCalendarConnections(
  adminClient: SupabaseClient<Database>,
  limit = 25
): Promise<SyncCalendarConnectionsResult> {
  const { data, error } = await adminClient
    .from('provider_connections')
    .select('*')
    .in('status', ['active', 'error'])
    .limit(limit)

  if (error) {
    throw new Error(`Failed to load calendar connections: ${error.message}`)
  }

  const connections = (data ?? []) as ProviderConnectionRow[]
  const result: SyncCalendarConnectionsResult = {
    checked: connections.length,
    synced: 0,
    failed: 0,
  }

  for (const connection of connections) {
    try {
      await syncCalendarsForConnection(adminClient, connection.id)
      result.synced += 1
    } catch {
      result.failed += 1
    }
  }

  return result
}

export async function syncCalendarsForConnection(
  adminClient: SupabaseClient<Database>,
  connectionId: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ calendars: number }> {
  const connection = await loadProviderConnection(adminClient, connectionId)

  try {
    const accessToken = await getFreshAccessToken(adminClient, connection, fetchImpl)
    const calendars = await listProviderCalendars(
      connection.provider as CalendarProvider,
      accessToken,
      fetchImpl
    )

    await upsertProviderCalendars(adminClient, connection.id, calendars)
    const busyCalendars = await loadAvailabilityCalendars(
      adminClient,
      connection.id
    )
    const busyWindow = syncWindow()
    await syncBusyCache({
      adminClient,
      connection,
      accessToken,
      calendars: busyCalendars,
      windowStart: busyWindow.start,
      windowEnd: busyWindow.end,
      fetchImpl,
    })
    await adminClient
      .from('provider_connections')
      .update({
        status: 'active',
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)

    return { calendars: calendars.length }
  } catch (error) {
    await adminClient
      .from('provider_connections')
      .update({
        status: 'error',
        last_error: errorMessage(error),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)
    throw error
  }
}

export async function getFreshAccessToken(
  adminClient: SupabaseClient<Database>,
  connection: ProviderConnectionRow,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  if (connection.access_token_encrypted && !isTokenExpiring(connection)) {
    return decryptToken(connection.access_token_encrypted)
  }

  if (!connection.refresh_token_encrypted) {
    if (connection.access_token_encrypted) {
      return decryptToken(connection.access_token_encrypted)
    }

    throw new Error('Calendar connection has no refresh token')
  }

  const refreshToken = decryptToken(connection.refresh_token_encrypted)
  const tokens = await refreshCalendarAccessToken({
    provider: connection.provider as CalendarProvider,
    refreshToken,
    fetchImpl,
  })
  const nextRefreshToken = tokens.refreshToken ?? refreshToken

  await adminClient
    .from('provider_connections')
    .update({
      access_token_encrypted: encryptToken(tokens.accessToken),
      refresh_token_encrypted: encryptToken(nextRefreshToken),
      token_expires_at: tokens.expiresAt,
      scopes: tokens.scopes,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  return tokens.accessToken
}

export async function createProviderCalendarEvent({
  provider,
  accessToken,
  externalCalendarId,
  event,
  fetchImpl = fetch,
}: {
  provider: CalendarProvider
  accessToken: string
  externalCalendarId: string
  event: ProviderCalendarEventInput
  fetchImpl?: typeof fetch
}): Promise<ProviderCalendarEventResult> {
  if (provider === 'google') {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        externalCalendarId
      )}/events`
    )
    url.searchParams.set('sendUpdates', 'none')
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: providerHeaders(accessToken),
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        start: { dateTime: event.startAt },
        end: { dateTime: event.endAt },
        attendees: [
          {
            email: event.guestEmail,
            displayName: event.guestName,
          },
        ],
      }),
    })
    const data = await parseProviderJson<GoogleEventResponse>(response)

    if (!data.id) {
      throw new Error('Google Calendar did not return an event id')
    }

    return {
      externalEventId: data.id,
      providerEventUrl: data.htmlLink ?? null,
      metadata: { etag: data.etag ?? null },
    }
  }

  const response = await fetchImpl(
    `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(
      externalCalendarId
    )}/events`,
    {
      method: 'POST',
      headers: providerHeaders(accessToken),
      body: JSON.stringify({
        subject: event.title,
        body: {
          contentType: 'text',
          content: event.description,
        },
        start: {
          dateTime: event.startAt,
          timeZone: 'UTC',
        },
        end: {
          dateTime: event.endAt,
          timeZone: 'UTC',
        },
        attendees: [
          {
            emailAddress: {
              address: event.guestEmail,
              name: event.guestName,
            },
            type: 'required',
          },
        ],
        transactionId: event.bookingId,
      }),
    }
  )
  const data = await parseProviderJson<MicrosoftEventResponse>(response)

  if (!data.id) {
    throw new Error('Microsoft Graph did not return an event id')
  }

  return {
    externalEventId: data.id,
    providerEventUrl: data.webLink ?? null,
    metadata: { changeKey: data.changeKey ?? null },
  }
}

export async function deleteProviderCalendarEvent({
  provider,
  accessToken,
  externalCalendarId,
  externalEventId,
  fetchImpl = fetch,
}: {
  provider: CalendarProvider
  accessToken: string
  externalCalendarId: string
  externalEventId: string
  fetchImpl?: typeof fetch
}): Promise<void> {
  const url =
    provider === 'google'
      ? googleDeleteEventUrl(externalCalendarId, externalEventId)
      : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(
          externalCalendarId
        )}/events/${encodeURIComponent(externalEventId)}`

  const response = await fetchImpl(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (response.status === 404 || response.status === 410) {
    return
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `Provider event delete failed with HTTP ${response.status}: ${body.slice(0, 500)}`
    )
  }
}

async function loadProviderConnection(
  adminClient: SupabaseClient<Database>,
  connectionId: string
): Promise<ProviderConnectionRow> {
  const { data, error } = await adminClient
    .from('provider_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (error || !data) {
    throw new Error(`Calendar connection not found: ${connectionId}`)
  }

  return data as ProviderConnectionRow
}

async function listProviderCalendars(
  provider: CalendarProvider,
  accessToken: string,
  fetchImpl: typeof fetch
): Promise<ProviderCalendarSummary[]> {
  return provider === 'google'
    ? listGoogleCalendars(accessToken, fetchImpl)
    : listMicrosoftCalendars(accessToken, fetchImpl)
}

async function listGoogleCalendars(
  accessToken: string,
  fetchImpl: typeof fetch
): Promise<ProviderCalendarSummary[]> {
  const calendars: ProviderCalendarSummary[] = []
  let nextPageToken: string | undefined

  do {
    const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList')
    url.searchParams.set('maxResults', '250')
    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken)
    }

    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await parseProviderJson<GoogleCalendarListResponse>(response)

    for (const item of data.items ?? []) {
      if (!item.id || item.deleted) continue
      const accessRole = item.accessRole ?? 'reader'

      calendars.push({
        externalCalendarId: item.id,
        summary: item.summary ?? item.id,
        timezone: item.timeZone ?? null,
        isPrimary: item.primary ?? false,
        canWrite: accessRole === 'writer' || accessRole === 'owner',
        metadata: { accessRole },
      })
    }

    nextPageToken = data.nextPageToken
  } while (nextPageToken)

  return calendars
}

async function listMicrosoftCalendars(
  accessToken: string,
  fetchImpl: typeof fetch
): Promise<ProviderCalendarSummary[]> {
  const calendars: ProviderCalendarSummary[] = []
  let url: string | undefined =
    'https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar,canEdit'

  while (url) {
    const response: Response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data: MicrosoftCalendarListResponse =
      await parseProviderJson<MicrosoftCalendarListResponse>(response)

    for (const item of data.value ?? []) {
      if (!item.id) continue

      calendars.push({
        externalCalendarId: item.id,
        summary: item.name ?? item.id,
        timezone: null,
        isPrimary: item.isDefaultCalendar ?? false,
        canWrite: item.canEdit ?? true,
        metadata: { canEdit: item.canEdit ?? null },
      })
    }

    url = data['@odata.nextLink']
  }

  return calendars
}

async function upsertProviderCalendars(
  adminClient: SupabaseClient<Database>,
  connectionId: string,
  calendars: ProviderCalendarSummary[]
): Promise<void> {
  const { data: existingData, error } = await adminClient
    .from('provider_calendars')
    .select('*')
    .eq('connection_id', connectionId)

  if (error) {
    throw new Error(`Failed to load provider calendars: ${error.message}`)
  }

  const existingByExternalId = new Map(
    ((existingData ?? []) as ProviderCalendarRow[]).map((calendar) => [
      calendar.external_calendar_id,
      calendar,
    ])
  )

  for (const calendar of calendars) {
    const existing = existingByExternalId.get(calendar.externalCalendarId)
    const payload = {
      external_calendar_id: calendar.externalCalendarId,
      summary: calendar.summary,
      timezone: calendar.timezone,
      is_primary: calendar.isPrimary,
      metadata: calendar.metadata,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error: updateError } = await adminClient
        .from('provider_calendars')
        .update(payload)
        .eq('id', existing.id)

      if (updateError) {
        throw new Error(`Failed to update provider calendar: ${updateError.message}`)
      }
      continue
    }

    const { error: insertError } = await adminClient
      .from('provider_calendars')
      .insert({
        ...payload,
        connection_id: connectionId,
        use_for_availability: true,
        use_for_writes: calendar.isPrimary && calendar.canWrite,
      })

    if (insertError) {
      throw new Error(`Failed to insert provider calendar: ${insertError.message}`)
    }
  }
}

async function loadAvailabilityCalendars(
  adminClient: SupabaseClient<Database>,
  connectionId: string
): Promise<ProviderCalendarRow[]> {
  const { data, error } = await adminClient
    .from('provider_calendars')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('use_for_availability', true)

  if (error) {
    throw new Error(`Failed to load availability calendars: ${error.message}`)
  }

  return (data ?? []) as ProviderCalendarRow[]
}

async function syncBusyCache({
  adminClient,
  connection,
  accessToken,
  calendars,
  windowStart,
  windowEnd,
  fetchImpl,
}: {
  adminClient: SupabaseClient<Database>
  connection: ProviderConnectionRow
  accessToken: string
  calendars: ProviderCalendarRow[]
  windowStart: string
  windowEnd: string
  fetchImpl: typeof fetch
}): Promise<void> {
  for (const calendar of calendars) {
    const busyEvents = await listProviderBusyEvents({
      provider: connection.provider as CalendarProvider,
      accessToken,
      externalCalendarId: calendar.external_calendar_id,
      windowStart,
      windowEnd,
      fetchImpl,
    })

    const deleteQuery = adminClient
      .from('external_busy_cache')
      .delete()
      .eq('provider_calendar_id', calendar.id)
      .gte('start_at', windowStart)
      .lt('start_at', windowEnd)

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      throw new Error(`Failed to prune busy cache: ${deleteError.message}`)
    }

    if (busyEvents.length === 0) {
      continue
    }

    const { error: insertError } = await adminClient
      .from('external_busy_cache')
      .insert(
        busyEvents.map((event) => ({
          provider_calendar_id: calendar.id,
          source_event_id: event.sourceEventId,
          start_at: event.startAt,
          end_at: event.endAt,
          transparency: event.transparency,
          etag: event.etag,
          last_synced_at: new Date().toISOString(),
          metadata: event.metadata,
        }))
      )

    if (insertError) {
      throw new Error(`Failed to write busy cache: ${insertError.message}`)
    }
  }
}

async function listProviderBusyEvents({
  provider,
  accessToken,
  externalCalendarId,
  windowStart,
  windowEnd,
  fetchImpl,
}: {
  provider: CalendarProvider
  accessToken: string
  externalCalendarId: string
  windowStart: string
  windowEnd: string
  fetchImpl: typeof fetch
}): Promise<ProviderBusyEvent[]> {
  return provider === 'google'
    ? listGoogleBusyEvents({
        accessToken,
        externalCalendarId,
        windowStart,
        windowEnd,
        fetchImpl,
      })
    : listMicrosoftBusyEvents({
        accessToken,
        externalCalendarId,
        windowStart,
        windowEnd,
        fetchImpl,
      })
}

async function listGoogleBusyEvents({
  accessToken,
  externalCalendarId,
  windowStart,
  windowEnd,
  fetchImpl,
}: {
  accessToken: string
  externalCalendarId: string
  windowStart: string
  windowEnd: string
  fetchImpl: typeof fetch
}): Promise<ProviderBusyEvent[]> {
  const busyEvents: ProviderBusyEvent[] = []
  let nextPageToken: string | undefined

  do {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        externalCalendarId
      )}/events`
    )
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('showDeleted', 'false')
    url.searchParams.set('timeMin', windowStart)
    url.searchParams.set('timeMax', windowEnd)
    url.searchParams.set('maxResults', '2500')
    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken)
    }

    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await parseProviderJson<GoogleEventsResponse>(response)

    for (const item of data.items ?? []) {
      if (
        !item.id ||
        item.status === 'cancelled' ||
        item.transparency === 'transparent'
      ) {
        continue
      }

      const startAt = googleEventTime(item.start)
      const endAt = googleEventTime(item.end)

      if (!startAt || !endAt || startAt >= endAt) {
        continue
      }

      busyEvents.push({
        sourceEventId: item.id,
        startAt,
        endAt,
        transparency: item.transparency === 'opaque' ? 'opaque' : 'busy',
        etag: item.etag ?? null,
        metadata: { provider: 'google' },
      })
    }

    nextPageToken = data.nextPageToken
  } while (nextPageToken)

  return busyEvents
}

async function listMicrosoftBusyEvents({
  accessToken,
  externalCalendarId,
  windowStart,
  windowEnd,
  fetchImpl,
}: {
  accessToken: string
  externalCalendarId: string
  windowStart: string
  windowEnd: string
  fetchImpl: typeof fetch
}): Promise<ProviderBusyEvent[]> {
  const busyEvents: ProviderBusyEvent[] = []
  let url: string | undefined =
    `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(
      externalCalendarId
    )}/calendarView?startDateTime=${encodeURIComponent(
      windowStart
    )}&endDateTime=${encodeURIComponent(
      windowEnd
    )}&$select=id,showAs,start,end,changeKey&$top=1000`

  while (url) {
    const response: Response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data: MicrosoftCalendarViewResponse =
      await parseProviderJson<MicrosoftCalendarViewResponse>(response)

    for (const item of data.value ?? []) {
      if (!item.id || item.showAs === 'free' || item.showAs === 'workingElsewhere') {
        continue
      }

      const startAt = microsoftEventTime(item.start)
      const endAt = microsoftEventTime(item.end)

      if (!startAt || !endAt || startAt >= endAt) {
        continue
      }

      busyEvents.push({
        sourceEventId: item.id,
        startAt,
        endAt,
        transparency: item.showAs === 'tentative' ? 'tentative' : 'busy',
        etag: item.changeKey ?? null,
        metadata: {
          provider: 'microsoft',
          showAs: item.showAs ?? null,
        },
      })
    }

    url = data['@odata.nextLink']
  }

  return busyEvents
}

function isTokenExpiring(connection: ProviderConnectionRow): boolean {
  if (!connection.token_expires_at) {
    return false
  }

  return (
    new Date(connection.token_expires_at).getTime() - Date.now() <
    TOKEN_REFRESH_WINDOW_MS
  )
}

function syncWindow(): { start: string; end: string } {
  const start = new Date()
  const end = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

function googleEventTime(value?: {
  dateTime?: string
  date?: string
}): string | null {
  const rawValue = value?.dateTime ?? value?.date
  return rawValue ? new Date(rawValue).toISOString() : null
}

function microsoftEventTime(value?: {
  dateTime?: string
  timeZone?: string
}): string | null {
  if (!value?.dateTime) {
    return null
  }

  const hasOffset = /(?:z|[+-]\d\d:\d\d)$/i.test(value.dateTime)
  return new Date(hasOffset ? value.dateTime : `${value.dateTime}Z`).toISOString()
}

function providerHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

async function parseProviderJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string }
    error_description?: string
  }

  if (!response.ok) {
    throw new Error(
      data.error?.message ??
        data.error_description ??
        `Provider request failed with HTTP ${response.status}`
    )
  }

  return data
}

function googleDeleteEventUrl(
  externalCalendarId: string,
  externalEventId: string
): URL {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      externalCalendarId
    )}/events/${encodeURIComponent(externalEventId)}`
  )
  url.searchParams.set('sendUpdates', 'none')
  return url
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
