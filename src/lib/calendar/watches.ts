import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalendarProvider } from './oauth'
import type { Database, Json, Tables } from '@/lib/types/database'
import {
  DEFAULT_BUSY_SYNC_WINDOW_MS,
  getFreshAccessToken,
  refreshProviderCalendarBusyCache,
} from './provider-sync'

type ProviderConnectionRow = Tables<'provider_connections'>
type ProviderCalendarRow = Tables<'provider_calendars'>
type ProviderWatchRow = Tables<'provider_watches'>
type ProviderWatchInsert = Database['public']['Tables']['provider_watches']['Insert']

const WATCH_RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000
const GOOGLE_WATCH_TTL_SECONDS = 7 * 24 * 60 * 60
const MICROSOFT_SUBSCRIPTION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

export interface CalendarWatchLifecycleResult {
  checked: number
  ensured: number
  skipped: number
  failed: number
}

export type CalendarWebhookResult =
  | { ok: true; status: 200 | 202 | 204; ignored?: boolean }
  | { ok: false; status: 400 | 401 | 404 | 500; error: string }

interface GoogleWatchResponse {
  id?: string
  resourceId?: string
  expiration?: string
}

interface MicrosoftSubscriptionResponse {
  id?: string
  resource?: string
  expirationDateTime?: string
}

interface MicrosoftNotification {
  subscriptionId?: unknown
  clientState?: unknown
}

/**
 * Ensures every active availability calendar for one connection has a provider
 * watch/subscription, renewing records that are close to expiration.
 */
export async function ensureCalendarWatchesForConnection(
  adminClient: SupabaseClient<Database>,
  connectionId: string,
  fetchImpl: typeof fetch = fetch
): Promise<CalendarWatchLifecycleResult> {
  const connection = await loadProviderConnection(adminClient, connectionId)
  const calendars = await loadAvailabilityCalendars(adminClient, connectionId)
  const result: CalendarWatchLifecycleResult = {
    checked: calendars.length,
    ensured: 0,
    skipped: 0,
    failed: 0,
  }

  for (const calendar of calendars) {
    try {
      const ensured = await ensureProviderWatch({
        adminClient,
        connection,
        calendar,
        fetchImpl,
      })

      if (ensured) {
        result.ensured += 1
      } else {
        result.skipped += 1
      }
    } catch (error) {
      result.failed += 1
      await markCalendarWatchError({
        adminClient,
        connection,
        calendar,
        error,
      })
    }
  }

  return result
}

/**
 * Sync-worker helper that creates missing watches and renews due subscriptions.
 */
export async function maintainCalendarWatches(
  adminClient: SupabaseClient<Database>,
  limit = 25,
  fetchImpl: typeof fetch = fetch
): Promise<CalendarWatchLifecycleResult> {
  const { data, error } = await adminClient
    .from('provider_connections')
    .select('id')
    .in('status', ['active', 'error'])
    .limit(limit)

  if (error) {
    throw new Error(`Failed to load calendar connections for watches: ${error.message}`)
  }

  const result: CalendarWatchLifecycleResult = {
    checked: 0,
    ensured: 0,
    skipped: 0,
    failed: 0,
  }

  for (const connection of (data ?? []) as Pick<ProviderConnectionRow, 'id'>[]) {
    const next = await ensureCalendarWatchesForConnection(
      adminClient,
      connection.id,
      fetchImpl
    )
    result.checked += next.checked
    result.ensured += next.ensured
    result.skipped += next.skipped
    result.failed += next.failed
  }

  return result
}

/**
 * Validates and handles a Google Calendar push notification.
 */
export async function handleGoogleCalendarWebhook(
  adminClient: SupabaseClient<Database>,
  headers: Headers,
  fetchImpl: typeof fetch = fetch
): Promise<CalendarWebhookResult> {
  const channelId = headers.get('x-goog-channel-id')
  const resourceId = headers.get('x-goog-resource-id')
  const resourceState = headers.get('x-goog-resource-state')
  const channelToken = headers.get('x-goog-channel-token')
  const messageNumber = headers.get('x-goog-message-number')

  if (!channelId || !resourceId || !resourceState || !channelToken) {
    return {
      ok: false,
      status: 400,
      error: 'Missing Google calendar webhook headers',
    }
  }

  const watch = await loadWatchByProviderChannel(adminClient, 'google', channelId)

  if (!watch) {
    return { ok: false, status: 404, error: 'Calendar watch not found' }
  }

  if (watch.resource_id !== resourceId) {
    return { ok: false, status: 401, error: 'Invalid Google calendar resource' }
  }

  if (!verifyMetadataSecret(watch.metadata, 'tokenHash', channelToken)) {
    return { ok: false, status: 401, error: 'Invalid Google calendar token' }
  }

  await updateWatchCallbackState(adminClient, watch, {
    lastMessageNumber: messageNumber,
    lastResourceState: resourceState,
  })

  if (resourceState === 'sync') {
    return { ok: true, status: 204, ignored: true }
  }

  try {
    await refreshWatchBusyCache(adminClient, watch, fetchImpl)
    return { ok: true, status: 204 }
  } catch (error) {
    await updateWatchError(adminClient, watch, error)
    return { ok: false, status: 500, error: 'Failed to refresh calendar cache' }
  }
}

/**
 * Validates Microsoft Graph change notifications and refreshes each affected
 * subscription once per callback payload.
 */
export async function handleMicrosoftCalendarWebhook(
  adminClient: SupabaseClient<Database>,
  body: unknown,
  fetchImpl: typeof fetch = fetch
): Promise<CalendarWebhookResult> {
  const notifications = microsoftNotifications(body)

  if (notifications.length === 0) {
    return { ok: true, status: 202, ignored: true }
  }

  const uniqueSubscriptions = new Map<string, ProviderWatchRow>()

  for (const notification of notifications) {
    const subscriptionId =
      typeof notification.subscriptionId === 'string'
        ? notification.subscriptionId
        : null
    const clientState =
      typeof notification.clientState === 'string' ? notification.clientState : null

    if (!subscriptionId || !clientState) {
      return {
        ok: false,
        status: 400,
        error: 'Missing Microsoft calendar notification fields',
      }
    }

    const watch = await loadWatchByProviderChannel(
      adminClient,
      'microsoft',
      subscriptionId
    )

    if (!watch) {
      return { ok: false, status: 404, error: 'Calendar subscription not found' }
    }

    if (!verifyMetadataSecret(watch.metadata, 'clientStateHash', clientState)) {
      return { ok: false, status: 401, error: 'Invalid Microsoft client state' }
    }

    uniqueSubscriptions.set(subscriptionId, watch)
  }

  for (const watch of uniqueSubscriptions.values()) {
    try {
      await refreshWatchBusyCache(adminClient, watch, fetchImpl)
    } catch (error) {
      await updateWatchError(adminClient, watch, error)
      return { ok: false, status: 500, error: 'Failed to refresh calendar cache' }
    }
  }

  return { ok: true, status: 202 }
}

async function ensureProviderWatch({
  adminClient,
  connection,
  calendar,
  fetchImpl,
}: {
  adminClient: SupabaseClient<Database>
  connection: ProviderConnectionRow
  calendar: ProviderCalendarRow
  fetchImpl: typeof fetch
}): Promise<boolean> {
  const provider = connection.provider as CalendarProvider
  const existing = await loadWatchForCalendar(adminClient, {
    connectionId: connection.id,
    provider,
    externalCalendarId: calendar.external_calendar_id,
  })

  if (existing && !watchNeedsRenewal(existing)) {
    return false
  }

  const accessToken = await getFreshAccessToken(adminClient, connection, fetchImpl)

  if (provider === 'google') {
    await createGoogleWatch({
      adminClient,
      connection,
      calendar,
      existing,
      accessToken,
      fetchImpl,
    })
    return true
  }

  await createOrRenewMicrosoftSubscription({
    adminClient,
    connection,
    calendar,
    existing,
    accessToken,
    fetchImpl,
  })
  return true
}

async function createGoogleWatch({
  adminClient,
  connection,
  calendar,
  existing,
  accessToken,
  fetchImpl,
}: {
  adminClient: SupabaseClient<Database>
  connection: ProviderConnectionRow
  calendar: ProviderCalendarRow
  existing: ProviderWatchRow | null
  accessToken: string
  fetchImpl: typeof fetch
}) {
  const channelId = randomWatchId('goog')
  const token = randomSecret()
  const response = await fetchImpl(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendar.external_calendar_id
    )}/events/watch`,
    {
      method: 'POST',
      headers: providerHeaders(accessToken),
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: providerCallbackUrl('google'),
        token,
        params: { ttl: String(GOOGLE_WATCH_TTL_SECONDS) },
      }),
    }
  )
  const data = await parseProviderJson<GoogleWatchResponse>(response)

  await saveProviderWatch(adminClient, existing, {
    connection_id: connection.id,
    provider: 'google',
    external_calendar_id: calendar.external_calendar_id,
    channel_id: data.id ?? channelId,
    resource_id: data.resourceId ?? null,
    sync_cursor: existing?.sync_cursor ?? null,
    expiration_at: googleExpiration(data.expiration),
    status: 'active',
    last_error: null,
    metadata: {
      ...metadataObject(existing?.metadata),
      callbackUrl: providerCallbackUrl('google'),
      tokenHash: hashSecret(token),
    },
  })
}

async function createOrRenewMicrosoftSubscription({
  adminClient,
  connection,
  calendar,
  existing,
  accessToken,
  fetchImpl,
}: {
  adminClient: SupabaseClient<Database>
  connection: ProviderConnectionRow
  calendar: ProviderCalendarRow
  existing: ProviderWatchRow | null
  accessToken: string
  fetchImpl: typeof fetch
}) {
  if (existing?.channel_id && existing.status === 'active') {
    const renewed = await renewMicrosoftSubscription({
      adminClient,
      existing,
      accessToken,
      fetchImpl,
    })

    if (renewed) {
      return
    }
  }

  const clientState = randomSecret()
  const expirationAt = microsoftExpiration()
  const response = await fetchImpl('https://graph.microsoft.com/v1.0/subscriptions', {
    method: 'POST',
    headers: providerHeaders(accessToken),
    body: JSON.stringify({
      changeType: 'created,updated,deleted',
      notificationUrl: providerCallbackUrl('microsoft'),
      resource: microsoftCalendarResource(calendar.external_calendar_id),
      expirationDateTime: expirationAt,
      clientState,
    }),
  })
  const data = await parseProviderJson<MicrosoftSubscriptionResponse>(response)

  if (!data.id) {
    throw new Error('Microsoft Graph did not return a subscription id')
  }

  await saveProviderWatch(adminClient, existing, {
    connection_id: connection.id,
    provider: 'microsoft',
    external_calendar_id: calendar.external_calendar_id,
    channel_id: data.id,
    resource_id: data.resource ?? microsoftCalendarResource(calendar.external_calendar_id),
    sync_cursor: existing?.sync_cursor ?? null,
    expiration_at: data.expirationDateTime ?? expirationAt,
    status: 'active',
    last_error: null,
    metadata: {
      ...metadataObject(existing?.metadata),
      callbackUrl: providerCallbackUrl('microsoft'),
      clientStateHash: hashSecret(clientState),
    },
  })
}

async function renewMicrosoftSubscription({
  adminClient,
  existing,
  accessToken,
  fetchImpl,
}: {
  adminClient: SupabaseClient<Database>
  existing: ProviderWatchRow
  accessToken: string
  fetchImpl: typeof fetch
}): Promise<boolean> {
  const expirationAt = microsoftExpiration()
  const response = await fetchImpl(
    `https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(
      existing.channel_id ?? ''
    )}`,
    {
      method: 'PATCH',
      headers: providerHeaders(accessToken),
      body: JSON.stringify({ expirationDateTime: expirationAt }),
    }
  )

  if (response.status === 404 || response.status === 410) {
    return false
  }

  const data = await parseProviderJson<MicrosoftSubscriptionResponse>(response)

  await adminClient
    .from('provider_watches')
    .update({
      expiration_at: data.expirationDateTime ?? expirationAt,
      status: 'active',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)

  return true
}

async function refreshWatchBusyCache(
  adminClient: SupabaseClient<Database>,
  watch: ProviderWatchRow,
  fetchImpl: typeof fetch
) {
  const now = new Date()
  await refreshProviderCalendarBusyCache({
    adminClient,
    connectionId: watch.connection_id,
    externalCalendarId: watch.external_calendar_id,
    windowStart: now.toISOString(),
    windowEnd: new Date(now.getTime() + DEFAULT_BUSY_SYNC_WINDOW_MS).toISOString(),
    fetchImpl,
  })

  await adminClient
    .from('provider_watches')
    .update({
      status: 'active',
      last_sync_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', watch.id)
}

async function saveProviderWatch(
  adminClient: SupabaseClient<Database>,
  existing: ProviderWatchRow | null,
  payload: ProviderWatchInsert
) {
  const now = new Date().toISOString()

  if (existing) {
    const { error } = await adminClient
      .from('provider_watches')
      .update({
        ...payload,
        updated_at: now,
      })
      .eq('id', existing.id)

    if (error) {
      throw new Error(`Failed to update provider watch: ${error.message}`)
    }
    return
  }

  const { error } = await adminClient
    .from('provider_watches')
    .insert({
      ...payload,
      created_at: now,
      updated_at: now,
    })

  if (error) {
    throw new Error(`Failed to create provider watch: ${error.message}`)
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

async function loadWatchForCalendar(
  adminClient: SupabaseClient<Database>,
  {
    connectionId,
    provider,
    externalCalendarId,
  }: {
    connectionId: string
    provider: CalendarProvider
    externalCalendarId: string
  }
): Promise<ProviderWatchRow | null> {
  const { data, error } = await adminClient
    .from('provider_watches')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('provider', provider)
    .eq('external_calendar_id', externalCalendarId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load provider watch: ${error.message}`)
  }

  return (data as ProviderWatchRow | null) ?? null
}

async function loadWatchByProviderChannel(
  adminClient: SupabaseClient<Database>,
  provider: CalendarProvider,
  channelId: string
): Promise<ProviderWatchRow | null> {
  const { data, error } = await adminClient
    .from('provider_watches')
    .select('*')
    .eq('provider', provider)
    .eq('channel_id', channelId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load provider watch: ${error.message}`)
  }

  return (data as ProviderWatchRow | null) ?? null
}

async function markCalendarWatchError({
  adminClient,
  connection,
  calendar,
  error,
}: {
  adminClient: SupabaseClient<Database>
  connection: ProviderConnectionRow
  calendar: ProviderCalendarRow
  error: unknown
}) {
  const existing = await loadWatchForCalendar(adminClient, {
    connectionId: connection.id,
    provider: connection.provider as CalendarProvider,
    externalCalendarId: calendar.external_calendar_id,
  })

  const payload = {
    connection_id: connection.id,
    provider: connection.provider,
    external_calendar_id: calendar.external_calendar_id,
    status: 'error',
    last_error: errorMessage(error),
    metadata: metadataObject(existing?.metadata),
  }

  await saveProviderWatch(adminClient, existing, payload)
}

async function updateWatchCallbackState(
  adminClient: SupabaseClient<Database>,
  watch: ProviderWatchRow,
  metadata: Record<string, string | null>
) {
  await adminClient
    .from('provider_watches')
    .update({
      last_sync_at: new Date().toISOString(),
      metadata: {
        ...metadataObject(watch.metadata),
        ...metadata,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', watch.id)
}

async function updateWatchError(
  adminClient: SupabaseClient<Database>,
  watch: ProviderWatchRow,
  error: unknown
) {
  await adminClient
    .from('provider_watches')
    .update({
      status: 'error',
      last_error: errorMessage(error),
      updated_at: new Date().toISOString(),
    })
    .eq('id', watch.id)
}

function watchNeedsRenewal(watch: ProviderWatchRow): boolean {
  if (watch.status !== 'active') {
    return true
  }

  if (!watch.expiration_at) {
    return true
  }

  return (
    new Date(watch.expiration_at).getTime() - Date.now() <=
    WATCH_RENEWAL_WINDOW_MS
  )
}

function providerCallbackUrl(provider: CalendarProvider): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return new URL(`/api/calendar/webhooks/${provider}`, origin).toString()
}

function microsoftCalendarResource(externalCalendarId: string): string {
  return `me/calendars/${externalCalendarId}/events`
}

function googleExpiration(expiration?: string): string | null {
  if (!expiration) {
    return new Date(Date.now() + GOOGLE_WATCH_TTL_SECONDS * 1000).toISOString()
  }

  const numeric = Number(expiration)
  if (!Number.isFinite(numeric)) {
    return null
  }

  return new Date(numeric).toISOString()
}

function microsoftExpiration(): string {
  return new Date(Date.now() + MICROSOFT_SUBSCRIPTION_WINDOW_MS).toISOString()
}

function microsoftNotifications(body: unknown): MicrosoftNotification[] {
  if (!body || typeof body !== 'object') {
    return []
  }

  const value = (body as { value?: unknown }).value
  return Array.isArray(value) ? (value as MicrosoftNotification[]) : []
}

function providerHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

function randomWatchId(prefix: string): string {
  return `${prefix}-${randomBytes(16).toString('hex')}`
}

function randomSecret(): string {
  return randomBytes(24).toString('base64url')
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function verifyMetadataSecret(
  metadata: Json,
  key: 'tokenHash' | 'clientStateHash',
  value: string
): boolean {
  const expected = metadataObject(metadata)[key]
  if (typeof expected !== 'string') {
    return false
  }

  const actual = hashSecret(value)
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  )
}

function metadataObject(metadata: Json | undefined): Record<string, Json> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {}
  }

  return metadata as Record<string, Json>
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
