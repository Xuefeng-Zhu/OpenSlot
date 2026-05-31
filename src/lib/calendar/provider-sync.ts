import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import { fromZonedTime } from 'date-fns-tz'
import type { CalendarProvider } from './oauth'
import type { Database, Json, Tables } from '@/lib/types/database'
import type { VideoProvider } from '@/lib/calendar/video-providers'
import { decryptToken, encryptToken } from '@/lib/security/token-encryption'
import { refreshCalendarAccessToken } from './oauth'
import {
  calendarErrorMessage,
  parseProviderJson,
  providerHeaders,
} from './provider-http'

type ProviderConnectionRow = Tables<'provider_connections'>
type ProviderCalendarRow = Tables<'provider_calendars'>
type SyncCalendarsOptions = {
  abortSignal?: AbortSignal
  windowStart?: string
  windowEnd?: string
}

const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000
const AVAILABILITY_REFRESH_INTERVAL_MS = 5 * 60 * 1000
export const DEFAULT_BUSY_SYNC_WINDOW_MS = 90 * 24 * 60 * 60 * 1000

type AvailabilityRefreshConnection = Pick<
  ProviderConnectionRow,
  'id' | 'status' | 'last_synced_at' | 'updated_at'
>

export interface SyncCalendarConnectionsResult {
  checked: number
  synced: number
  failed: number
}

export interface RefreshCalendarAvailabilityResult {
  checked: number
  refreshed: number
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
  conferenceProvider?: VideoProvider | null
}

export interface ProviderCalendarEventResult {
  externalEventId: string
  providerEventUrl: string | null
  conferenceUrl: string | null
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

export interface ProviderBusyEvent {
  sourceEventId: string
  startAt: string
  endAt: string
  transparency: string
  etag: string | null
  metadata: Json
}

type BusyCachePruneRow = Pick<
  Tables<'external_busy_cache'>,
  'id' | 'source_event_id'
>

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
    start?: { dateTime?: string; date?: string; timeZone?: string }
    end?: { dateTime?: string; date?: string; timeZone?: string }
  }>
  nextPageToken?: string
}

interface GoogleEventResponse {
  id?: string
  htmlLink?: string
  hangoutLink?: string
  etag?: string
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string
      uri?: string
    }>
    createRequest?: {
      status?: {
        statusCode?: string
      }
    }
  }
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
  onlineMeeting?: {
    joinUrl?: string
  }
}

/**
 * Syncs a bounded set of active or previously errored calendar connections.
 * Each connection is isolated so one provider failure increments the failure
 * count without preventing later connections from syncing.
 */
export async function syncActiveCalendarConnections(
  adminClient: BackendCompatClient<Database>,
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

/**
 * Refreshes one provider connection from the upstream calendar API.
 * This updates the calendar list, rebuilds the configured busy-cache window,
 * and marks the connection active or errored based on the provider outcome.
 */
export async function syncCalendarsForConnection(
  adminClient: BackendCompatClient<Database>,
  connectionId: string,
  fetchImpl: typeof fetch = fetch,
  options: SyncCalendarsOptions = {}
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
    const busyWindow =
      options.windowStart && options.windowEnd
        ? { start: options.windowStart, end: options.windowEnd }
        : syncWindow()
    await syncBusyCache({
      adminClient,
      connection,
      accessToken,
      calendars: busyCalendars,
      windowStart: busyWindow.start,
      windowEnd: busyWindow.end,
      fetchImpl,
      abortSignal: options.abortSignal,
    })
    throwIfAborted(options.abortSignal)
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
    if (isAbortLikeError(error, options.abortSignal)) {
      throw error
    }

    await adminClient
      .from('provider_connections')
      .update({
        status: 'error',
        last_error: calendarErrorMessage(error),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)
    throw error
  }
}

function isAbortLikeError(error: unknown, abortSignal?: AbortSignal): boolean {
  if (abortSignal?.aborted) return true
  if (!(error instanceof Error)) return false
  if (error.name === 'AbortError') return true

  return isAbortLikeError(
    (error as Error & { cause?: unknown }).cause,
    undefined
  )
}

function throwIfAborted(abortSignal?: AbortSignal) {
  if (!abortSignal?.aborted) return

  if (abortSignal.reason instanceof Error) {
    throw abortSignal.reason
  }

  const abortError = new Error('Calendar sync aborted')
  abortError.name = 'AbortError'
  throw abortError
}

/**
 * Refreshes calendar busy cache for the requested host when the cache is stale
 * or the requested range falls beyond the normal rolling sync window.
 */
export async function refreshCalendarAvailabilityForHost(
  adminClient: BackendCompatClient<Database>,
  profileId: string,
  rangeStart: string,
  rangeEnd: string,
  fetchImpl: typeof fetch = fetch,
  options: { abortSignal?: AbortSignal } = {}
): Promise<RefreshCalendarAvailabilityResult> {
  const { data, error } = await adminClient
    .from('provider_connections')
    .select('id, status, last_synced_at, updated_at')
    .eq('profile_id', profileId)
    .in('status', ['active', 'error'])

  if (error) {
    throw new Error(`Failed to load calendar connections: ${error.message}`)
  }

  const connections = (data ?? []) as AvailabilityRefreshConnection[]
  const result: RefreshCalendarAvailabilityResult = {
    checked: connections.length,
    refreshed: 0,
    failed: 0,
  }
  const nowMs = Date.now()

  for (const connection of connections) {
    if (options.abortSignal?.aborted) {
      break
    }

    if (!shouldRefreshAvailabilityCache(connection, rangeEnd, nowMs)) {
      continue
    }

    try {
      await syncCalendarsForConnection(adminClient, connection.id, fetchImpl, {
        abortSignal: options.abortSignal,
        windowStart: rangeStart,
        windowEnd: rangeEnd,
      })
      result.refreshed += 1
    } catch (error) {
      if (isAbortLikeError(error, options.abortSignal)) {
        break
      }

      result.failed += 1
    }
  }

  return result
}

/**
 * Refreshes a single provider calendar's busy cache for a requested window.
 * Provider watch callbacks use this narrower path so one changed calendar does
 * not force a full account calendar-list sync.
 */
export async function refreshProviderCalendarBusyCache({
  adminClient,
  connectionId,
  externalCalendarId,
  windowStart,
  windowEnd,
  fetchImpl = fetch,
}: {
  adminClient: BackendCompatClient<Database>
  connectionId: string
  externalCalendarId: string
  windowStart: string
  windowEnd: string
  fetchImpl?: typeof fetch
}): Promise<void> {
  const connection = await loadProviderConnection(adminClient, connectionId)
  const accessToken = await getFreshAccessToken(adminClient, connection, fetchImpl)

  const { data: calendarData, error: calendarError } = await adminClient
    .from('provider_calendars')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('external_calendar_id', externalCalendarId)
    .eq('use_for_availability', true)
    .single()

  if (calendarError || !calendarData) {
    throw new Error(`Availability calendar not found: ${externalCalendarId}`)
  }

  await syncBusyCache({
    adminClient,
    connection,
    accessToken,
    calendars: [calendarData as ProviderCalendarRow],
    windowStart,
    windowEnd,
    fetchImpl,
  })
}

/**
 * Returns a usable access token for a provider connection.
 * Tokens are decrypted only server-side; expiring tokens are refreshed and the
 * replacement credentials are encrypted back into storage.
 *
 * Uses optimistic concurrency on `updated_at` to prevent concurrent refreshes
 * from overwriting each other's tokens — if another worker already refreshed,
 * the UPDATE matches 0 rows and we re-read the already-refreshed connection.
 */
export async function getFreshAccessToken(
  adminClient: BackendCompatClient<Database>,
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

  const refreshToken = await decryptToken(connection.refresh_token_encrypted)
  const tokens = await refreshCalendarAccessToken({
    provider: connection.provider as CalendarProvider,
    refreshToken,
    fetchImpl,
  })
  const nextRefreshToken = tokens.refreshToken ?? refreshToken

  const previousUpdatedAt = connection.updated_at

  const { data: updateResult } = await adminClient
    .from('provider_connections')
    .update({
      access_token_encrypted: await encryptToken(tokens.accessToken),
      refresh_token_encrypted: await encryptToken(nextRefreshToken),
      token_expires_at: tokens.expiresAt,
      scopes: tokens.scopes,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)
    .eq('updated_at', previousUpdatedAt)
    .select('id')

  if (!updateResult || updateResult.length === 0) {
    // Another worker already refreshed this token — re-read the connection
    const { data: freshConnection } = await adminClient
      .from('provider_connections')
      .select('access_token_encrypted')
      .eq('id', connection.id)
      .single()

    if (freshConnection?.access_token_encrypted) {
      return decryptToken(freshConnection.access_token_encrypted)
    }
  }

  return tokens.accessToken
}

/**
 * Creates an external calendar event for a confirmed booking.
 * Normalizes Google and Microsoft response shapes into the small reference
 * record OpenSlot stores for later cancellation or diagnostics.
 */
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
    const shouldCreateMeet = event.conferenceProvider === 'google_meet'
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        externalCalendarId
      )}/events`
    )
    url.searchParams.set('sendUpdates', 'none')
    if (shouldCreateMeet) {
      url.searchParams.set('conferenceDataVersion', '1')
    }

    const body = {
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
      ...(shouldCreateMeet
        ? {
            conferenceData: {
              createRequest: {
                requestId: `openslot-${event.bookingId}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          }
        : {}),
    }

    const response = await fetchImpl(url, {
      method: 'POST',
      headers: providerHeaders(accessToken),
      body: JSON.stringify(body),
    })
    const data = await parseProviderJson<GoogleEventResponse>(response)

    if (!data.id) {
      throw new Error('Google Calendar did not return an event id')
    }

    const conferenceUrl = shouldCreateMeet ? googleConferenceUrl(data) : null

    if (shouldCreateMeet && !conferenceUrl) {
      throw new Error('Google Calendar did not return a Meet link')
    }

    return {
      externalEventId: data.id,
      providerEventUrl: data.htmlLink ?? null,
      conferenceUrl,
      metadata: {
        etag: data.etag ?? null,
        conferenceProvider: shouldCreateMeet ? 'google_meet' : null,
        conferenceUrl,
        conferenceStatus: data.conferenceData?.createRequest?.status?.statusCode ?? null,
      },
    }
  }

  const shouldCreateTeams = event.conferenceProvider === 'microsoft_teams'
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
        ...(shouldCreateTeams
          ? {
              isOnlineMeeting: true,
              onlineMeetingProvider: 'teamsForBusiness',
            }
          : {}),
      }),
    }
  )
  const data = await parseProviderJson<MicrosoftEventResponse>(response)

  if (!data.id) {
    throw new Error('Microsoft Graph did not return an event id')
  }

  const conferenceUrl = shouldCreateTeams ? data.onlineMeeting?.joinUrl ?? null : null

  if (shouldCreateTeams && !conferenceUrl) {
    throw new Error('Microsoft Graph did not return a Teams join URL')
  }

  return {
    externalEventId: data.id,
    providerEventUrl: data.webLink ?? null,
    conferenceUrl,
    metadata: {
      changeKey: data.changeKey ?? null,
      conferenceProvider: shouldCreateTeams ? 'microsoft_teams' : null,
      conferenceUrl,
    },
  }
}

/**
 * Deletes an external provider event if it still exists.
 * Missing events are treated as already reconciled because cancellation workers
 * may be retried after a provider-side delete succeeds.
 */
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
  adminClient: BackendCompatClient<Database>,
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
  adminClient: BackendCompatClient<Database>,
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
  adminClient: BackendCompatClient<Database>,
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

/**
 * Rebuilds cached busy windows for calendars used in availability calculations.
 * The cache is replaced inside the requested sync window so deleted or changed
 * provider events stop blocking slots after the next successful sync.
 */
async function syncBusyCache({
  adminClient,
  connection,
  accessToken,
  calendars,
  windowStart,
  windowEnd,
  fetchImpl,
  abortSignal,
}: {
  adminClient: BackendCompatClient<Database>
  connection: ProviderConnectionRow
  accessToken: string
  calendars: ProviderCalendarRow[]
  windowStart: string
  windowEnd: string
  fetchImpl: typeof fetch
  abortSignal?: AbortSignal
}): Promise<void> {
  for (const calendar of calendars) {
    throwIfAborted(abortSignal)

    const busyEvents = await listProviderBusyEvents({
      provider: connection.provider as CalendarProvider,
      accessToken,
      externalCalendarId: calendar.external_calendar_id,
      calendarTimezone: calendar.timezone ?? 'UTC',
      windowStart,
      windowEnd,
      fetchImpl,
    })
    throwIfAborted(abortSignal)

    const currentSourceIds = new Set(
      busyEvents.map((event) => event.sourceEventId)
    )

    if (busyEvents.length > 0) {
      const lastSyncedAt = new Date().toISOString()
      const { error: upsertError } = await adminClient
        .from('external_busy_cache')
        .upsert(
          busyEvents.map((event) => ({
            provider_calendar_id: calendar.id,
            source_event_id: event.sourceEventId,
            start_at: event.startAt,
            end_at: event.endAt,
            transparency: event.transparency,
            etag: event.etag,
            last_synced_at: lastSyncedAt,
            updated_at: lastSyncedAt,
            metadata: event.metadata,
          })),
          { onConflict: 'provider_calendar_id,source_event_id' }
        )

      if (upsertError) {
        throw new Error(`Failed to write busy cache: ${upsertError.message}`)
      }
    }
    throwIfAborted(abortSignal)

    // Add/update current rows before pruning stale rows so concurrent slot reads
    // never observe an empty cache window during a refresh.
    const { data: staleCandidateData, error: staleCandidateError } =
      await adminClient
        .from('external_busy_cache')
        .select('id, source_event_id')
        .eq('provider_calendar_id', calendar.id)
        .lt('start_at', windowEnd)
        .gt('end_at', windowStart)

    if (staleCandidateError) {
      throw new Error(
        `Failed to inspect busy cache: ${staleCandidateError.message}`
      )
    }
    throwIfAborted(abortSignal)

    const staleRowIds = ((staleCandidateData ?? []) as BusyCachePruneRow[])
      .filter((row) => !currentSourceIds.has(row.source_event_id))
      .map((row) => row.id)

    if (staleRowIds.length > 0) {
      const { error: deleteError } = await adminClient
        .from('external_busy_cache')
        .delete()
        .in('id', staleRowIds)

      if (deleteError) {
        throw new Error(`Failed to prune busy cache: ${deleteError.message}`)
      }
    }
  }
}

export async function listProviderBusyEvents({
  provider,
  accessToken,
  externalCalendarId,
  calendarTimezone,
  windowStart,
  windowEnd,
  fetchImpl,
}: {
  provider: CalendarProvider
  accessToken: string
  externalCalendarId: string
  calendarTimezone: string
  windowStart: string
  windowEnd: string
  fetchImpl: typeof fetch
}): Promise<ProviderBusyEvent[]> {
  return provider === 'google'
    ? listGoogleBusyEvents({
        accessToken,
        externalCalendarId,
        calendarTimezone,
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
  calendarTimezone,
  windowStart,
  windowEnd,
  fetchImpl,
}: {
  accessToken: string
  externalCalendarId: string
  calendarTimezone: string
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

      const startAt = googleEventTime(item.start, calendarTimezone)
      const endAt = googleEventTime(item.end, calendarTimezone)

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
  const end = new Date(start.getTime() + DEFAULT_BUSY_SYNC_WINDOW_MS)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

function googleEventTime(
  value: { dateTime?: string; date?: string; timeZone?: string } | undefined,
  calendarTimezone: string
): string | null {
  if (!value) {
    return null
  }

  if (value.dateTime) {
    if (hasDateTimeOffset(value.dateTime)) {
      return new Date(value.dateTime).toISOString()
    }

    return fromZonedTime(
      value.dateTime,
      value.timeZone ?? calendarTimezone
    ).toISOString()
  }

  if (value.date) {
    return fromZonedTime(
      `${value.date}T00:00:00`,
      value.timeZone ?? calendarTimezone
    ).toISOString()
  }

  return null
}

/**
 * Normalizes Microsoft Graph calendarView timestamps to UTC ISO strings.
 * Graph may omit an offset while separately labeling the timeZone; this app
 * requests UTC windows, so offset-less values are interpreted as UTC.
 */
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

function googleConferenceUrl(data: GoogleEventResponse): string | null {
  const videoEntryPoint = data.conferenceData?.entryPoints?.find(
    (entryPoint) => entryPoint.entryPointType === 'video' && entryPoint.uri
  )

  return videoEntryPoint?.uri ?? data.hangoutLink ?? null
}

function shouldRefreshAvailabilityCache(
  connection: AvailabilityRefreshConnection,
  rangeEnd: string,
  nowMs: number
): boolean {
  const lastSyncedMs = timestampMs(connection.last_synced_at)

  if (connection.status === 'error') {
    const lastAttemptMs = timestampMs(connection.updated_at)
    if (
      lastAttemptMs !== null &&
      nowMs - lastAttemptMs < AVAILABILITY_REFRESH_INTERVAL_MS
    ) {
      return false
    }
  }

  if (lastSyncedMs === null) {
    return true
  }

  if (nowMs - lastSyncedMs < AVAILABILITY_REFRESH_INTERVAL_MS) {
    return false
  }

  const requestedEndMs = timestampMs(rangeEnd)

  if (
    requestedEndMs !== null &&
    requestedEndMs > lastSyncedMs + DEFAULT_BUSY_SYNC_WINDOW_MS
  ) {
    return true
  }

  return true
}

function timestampMs(value: string | null): number | null {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function hasDateTimeOffset(value: string): boolean {
  return /(?:z|[+-]\d\d:\d\d)$/i.test(value)
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
