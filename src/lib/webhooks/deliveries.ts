import { createHmac } from 'node:crypto'
import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database, Json, Tables } from '@/lib/types/database'

type OutboxEventRow = Tables<'outbox_events'>
type WebhookDeliveryRow = Tables<'webhook_deliveries'>

interface WebhookEndpointRow {
  id: string
  url: string
  secret_token: string
  is_active: boolean
  subscribed_events?: string[]
}

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
}

export interface ProcessWebhookDeliveriesResult {
  claimed: number
  delivered: number
  failed: number
}

const DEFAULT_LIMIT = 10
const DEFAULT_MAX_ATTEMPTS = 5

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
}: {
  delivery: WebhookDeliveryRow
  endpoint: WebhookEndpointRow
  fetchImpl: typeof fetch
}): Promise<{ status: number; body: string }> {
  const body = JSON.stringify(delivery.payload)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = signWebhookPayload(endpoint.secret_token, timestamp, body)

  const response = await fetchImpl(endpoint.url, {
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
  })

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
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')
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
