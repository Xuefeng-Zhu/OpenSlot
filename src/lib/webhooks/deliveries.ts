import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import { hmacSha256Hex } from '@/lib/security/edge-crypto'
import type { Database, Json, Tables } from '@/lib/types/database'
import {
  isSafeWebhookAddress,
  isSafeWebhookUrl,
} from '@/lib/validations/webhooks'

type OutboxEventRow = Tables<'outbox_events'>
type WebhookDeliveryRow = Tables<'webhook_deliveries'>

interface WebhookEndpointRow {
  id: string
  url: string
  secret_token: string
  is_active: boolean
  subscribed_events?: string[]
}

type WebhookHostnameResolver = (hostname: string) => Promise<string[]>

export interface EnqueueWebhookDeliveriesResult {
  queued: number
  duplicates: number
  skipped: number
  failed: number
}

export interface ProcessWebhookDeliveriesOptions {
  adminClient: BackendCompatClient<Database>
  limit?: number
  maxAttempts?: number
  fetchImpl?: typeof fetch
  resolveHostname?: WebhookHostnameResolver
}

export interface ProcessWebhookDeliveriesResult {
  claimed: number
  delivered: number
  failed: number
}

const DEFAULT_LIMIT = 10
const DEFAULT_MAX_ATTEMPTS = 5
const MAX_WEBHOOK_REDIRECTS = 5
const WEBHOOK_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/**
 * Expands a tenant webhook outbox event into endpoint-specific delivery rows.
 * Only active endpoints owned by the booking host and subscribed to the derived
 * domain event are queued; duplicate rows are counted as harmless retries.
 */
export async function enqueueWebhookDeliveriesForOutboxEvent(
  adminClient: BackendCompatClient<Database>,
  event: OutboxEventRow
): Promise<EnqueueWebhookDeliveriesResult> {
  const result: EnqueueWebhookDeliveriesResult = {
    queued: 0,
    duplicates: 0,
    skipped: 0,
    failed: 0,
  }
  const domainEventType = tenantWebhookDomainEvent(event.event_type)

  if (!domainEventType) {
    result.skipped += 1
    return result
  }

  const profileId = hostUserIdFromPayload(event.payload)

  if (!profileId) {
    result.skipped += 1
    return result
  }

  const { data: endpointsData, error: endpointsError } = await adminClient
    .from('webhook_endpoints')
    .select('id, subscribed_events')
    .eq('profile_id', profileId)
    .eq('is_active', true)

  if (endpointsError) {
    console.error('Error loading webhook endpoints:', endpointsError)
    result.failed += 1
    return result
  }

  const endpoints = (endpointsData ?? []) as Array<{
    id: string
    subscribed_events: string[]
  }>

  for (const endpoint of endpoints) {
    if (!isSubscribed(endpoint.subscribed_events, domainEventType)) {
      result.skipped += 1
      continue
    }

    const { error } = await adminClient
      .from('webhook_deliveries')
      .insert({
        endpoint_id: endpoint.id,
        outbox_event_id: event.id,
        event_type: domainEventType,
        payload: webhookPayload(event, domainEventType),
      })

    if (!error) {
      result.queued += 1
      continue
    }

    if (error.code === '23505') {
      result.duplicates += 1
      continue
    }

    console.error('Error enqueueing webhook delivery:', {
      code: error.code,
      message: error.message,
      endpointId: endpoint.id,
      outboxEventId: event.id,
    })
    result.failed += 1
  }

  return result
}

/**
 * Claims pending webhook deliveries, signs and POSTs each payload, and records
 * either the endpoint response or retry metadata. A custom fetch implementation
 * keeps this worker testable without real network calls.
 */
export async function processWebhookDeliveriesBatch({
  adminClient,
  limit = DEFAULT_LIMIT,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  fetchImpl = fetch,
  resolveHostname,
}: ProcessWebhookDeliveriesOptions): Promise<ProcessWebhookDeliveriesResult> {
  const { data: deliveriesData, error } = await adminClient.rpc(
    'claim_webhook_deliveries',
    {
      p_limit: limit,
      p_max_attempts: maxAttempts,
    }
  )

  if (error) {
    console.error('Error claiming webhook deliveries:', error)
    return { claimed: 0, delivered: 0, failed: 0 }
  }

  const deliveries = (deliveriesData ?? []) as WebhookDeliveryRow[]
  const result: ProcessWebhookDeliveriesResult = {
    claimed: deliveries.length,
    delivered: 0,
    failed: 0,
  }
  const destinationResolver =
    resolveHostname ??
    ((hostname: string) => resolveWebhookHostname(adminClient, hostname))

  for (const delivery of deliveries) {
    try {
      const endpoint = await loadWebhookEndpoint(adminClient, delivery.endpoint_id)

      if (!endpoint?.is_active) {
        throw new Error('Webhook endpoint is inactive or missing')
      }

      const deliveryResponse = await deliverWebhook({
        delivery,
        endpoint,
        fetchImpl,
        resolveHostname: destinationResolver,
      })
      await markWebhookDeliveryDelivered(
        adminClient,
        delivery.id,
        deliveryResponse.status,
        deliveryResponse.body
      )
      result.delivered += 1
    } catch (deliveryError) {
      await markWebhookDeliveryFailed(
        adminClient,
        delivery,
        deliveryError,
        maxAttempts
      )
      result.failed += 1
    }
  }

  return result
}

async function loadWebhookEndpoint(
  adminClient: BackendCompatClient<Database>,
  endpointId: string
): Promise<WebhookEndpointRow | null> {
  const { data, error } = await adminClient
    .from('webhook_endpoints')
    .select('id, url, secret_token, is_active')
    .eq('id', endpointId)
    .single()

  if (error || !data) {
    return null
  }

  return data as WebhookEndpointRow
}

/**
 * Sends one webhook delivery using OpenSlot's HMAC signature headers.
 * Non-2xx responses are treated as retryable failures and keep a bounded copy
 * of the endpoint body for dashboard diagnostics.
 */
async function deliverWebhook({
  delivery,
  endpoint,
  fetchImpl,
  resolveHostname,
}: {
  delivery: WebhookDeliveryRow
  endpoint: WebhookEndpointRow
  fetchImpl: typeof fetch
  resolveHostname: WebhookHostnameResolver
}): Promise<{ status: number; body: string }> {
  // Revalidate persisted endpoints at send time so legacy or externally
  // modified rows cannot bypass the current SSRF protections.
  if (!isSafeWebhookUrl(endpoint.url)) {
    throw new Error('Webhook endpoint URL is not allowed')
  }

  const body = JSON.stringify(delivery.payload)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = signWebhookPayload(endpoint.secret_token, timestamp, body)

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'OpenSlot-Webhooks/1.0',
      'X-OpenSlot-Event': delivery.event_type,
      'X-OpenSlot-Delivery': delivery.id,
      'X-OpenSlot-Timestamp': timestamp,
      'X-OpenSlot-Signature': `t=${timestamp},v1=${signature}`,
    },
    body,
  }
  const response = await fetchWebhookWithSafeRedirects(
    endpoint.url,
    requestInit,
    fetchImpl,
    resolveHostname
  )

  const responseBody = await response.text().catch(() => '')

  if (!response.ok) {
    throw new WebhookHttpError(
      response.status,
      responseBody.slice(0, 4000)
    )
  }

  return {
    status: response.status,
    body: responseBody.slice(0, 4000),
  }
}

async function fetchWebhookWithSafeRedirects(
  initialUrl: string,
  requestInit: RequestInit,
  fetchImpl: typeof fetch,
  resolveHostname: WebhookHostnameResolver
): Promise<Response> {
  let url = initialUrl
  let currentRequestInit = requestInit

  for (let redirectCount = 0; ; redirectCount += 1) {
    await assertSafeWebhookDestination(url, resolveHostname)

    const response = await fetchImpl(url, {
      ...currentRequestInit,
      redirect: 'manual',
    })

    if (!WEBHOOK_REDIRECT_STATUSES.has(response.status)) {
      return response
    }

    if (redirectCount >= MAX_WEBHOOK_REDIRECTS) {
      await response.body?.cancel().catch(() => undefined)
      throw new Error('Webhook endpoint exceeded the redirect limit')
    }

    const location = response.headers.get('location')
    if (!location) {
      await response.body?.cancel().catch(() => undefined)
      throw new Error('Webhook endpoint returned a redirect without a location')
    }

    const nextUrl = new URL(location, url).toString()
    if (!isSafeWebhookUrl(nextUrl)) {
      await response.body?.cancel().catch(() => undefined)
      throw new Error('Webhook redirect URL is not allowed')
    }

    currentRequestInit = redirectedWebhookRequestInit(
      response.status,
      currentRequestInit
    )
    await response.body?.cancel().catch(() => undefined)
    url = nextUrl
  }
}

async function assertSafeWebhookDestination(
  urlString: string,
  resolveHostname: WebhookHostnameResolver
): Promise<void> {
  if (!isSafeWebhookUrl(urlString)) {
    throw new Error('Webhook endpoint URL is not allowed')
  }

  const hostname = new URL(urlString).hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, '')
    .toLowerCase()

  if (isSafeWebhookAddress(hostname)) return

  const addresses = await resolveHostname(hostname)
  if (
    addresses.length === 0 ||
    addresses.some((address) => !isSafeWebhookAddress(address))
  ) {
    throw new Error('Webhook endpoint resolved to a non-public address')
  }
}

async function resolveWebhookHostname(
  adminClient: BackendCompatClient<Database>,
  hostname: string
): Promise<string[]> {
  const { data, error } = await adminClient
    .rpc('resolve_webhook_hostname', { p_hostname: hostname })
    .single<{ addresses: unknown }>()

  if (
    error ||
    !data ||
    !Array.isArray(data.addresses) ||
    !data.addresses.every((address) => typeof address === 'string')
  ) {
    throw new Error('Webhook destination DNS lookup failed')
  }

  return data.addresses as string[]
}

function redirectedWebhookRequestInit(
  status: number,
  requestInit: RequestInit
): RequestInit {
  const method = (requestInit.method ?? 'GET').toUpperCase()
  const changesPostToGet =
    ((status === 301 || status === 302) && method === 'POST') ||
    (status === 303 && method !== 'GET' && method !== 'HEAD')

  if (!changesPostToGet) return requestInit

  const headers = new Headers(requestInit.headers)
  for (const header of [
    'content-encoding',
    'content-language',
    'content-location',
    'content-type',
    'content-length',
  ]) {
    headers.delete(header)
  }

  return {
    ...requestInit,
    method: 'GET',
    body: undefined,
    headers,
  }
}

async function markWebhookDeliveryDelivered(
  adminClient: BackendCompatClient<Database>,
  deliveryId: string,
  responseCode: number,
  responseBody: string
) {
  const now = new Date().toISOString()
  const { error } = await adminClient
    .from('webhook_deliveries')
    .update({
      status: 'delivered',
      delivered_at: now,
      response_code: responseCode,
      response_body: responseBody,
      last_error: null,
      updated_at: now,
    })
    .eq('id', deliveryId)

  if (error) {
    console.error('Error marking webhook delivered:', error)
  }
}

async function markWebhookDeliveryFailed(
  adminClient: BackendCompatClient<Database>,
  delivery: WebhookDeliveryRow,
  error: unknown,
  maxAttempts: number
) {
  const lastError = error instanceof Error ? error.message : String(error)
  const retryDelayMs = retryDelayForAttempt(delivery.attempt_no, maxAttempts)
  const terminal = delivery.attempt_no >= maxAttempts
  const responseCode = error instanceof WebhookHttpError ? error.status : null
  const responseBody = error instanceof WebhookHttpError ? error.body : null

  const { error: updateError } = await adminClient
    .from('webhook_deliveries')
    .update({
      status: terminal ? 'abandoned' : 'failed',
      next_attempt_at: new Date(Date.now() + retryDelayMs).toISOString(),
      response_code: responseCode,
      response_body: responseBody,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery.id)

  if (updateError) {
    console.error('Error marking webhook failed:', updateError)
  }
}

function signWebhookPayload(secret: string, timestamp: string, body: string) {
  return hmacSha256Hex(secret, `${timestamp}.${body}`)
}

function retryDelayForAttempt(attemptNo: number, maxAttempts: number): number {
  if (attemptNo >= maxAttempts) {
    return 24 * 60 * 60 * 1000
  }

  const cappedAttempt = Math.min(Math.max(attemptNo, 1), 6)
  return 2 ** (cappedAttempt - 1) * 60 * 1000
}

function webhookPayload(event: OutboxEventRow, eventType: string): Json {
  return {
    id: event.id,
    type: eventType,
    createdAt: event.created_at,
    data: event.payload,
  }
}

/**
 * Maps internal outbox event names to tenant-facing webhook event names.
 * Returning null lets callers skip infrastructure events that have no public
 * webhook contract.
 */
function tenantWebhookDomainEvent(eventType: string): string | null {
  switch (eventType) {
    case 'tenant.webhooks.requested':
      return 'booking.confirmed'
    case 'tenant.webhooks.cancel.requested':
      return 'booking.cancelled'
    case 'tenant.webhooks.reschedule.requested':
      return 'booking.rescheduled'
    default:
      return null
  }
}

function hostUserIdFromPayload(payload: Json): string | null {
  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    typeof payload.hostUserId === 'string'
  ) {
    return payload.hostUserId
  }

  return null
}

function isSubscribed(subscribedEvents: string[], eventType: string): boolean {
  return subscribedEvents.includes('*') || subscribedEvents.includes(eventType)
}

class WebhookHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`Webhook endpoint returned HTTP ${status}`)
  }
}
