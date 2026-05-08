import { describe, expect, it, vi } from 'vitest'
import {
  enqueueWebhookDeliveriesForOutboxEvent,
  processWebhookDeliveriesBatch,
} from '../deliveries'

const outboxEvent = {
  id: 'outbox-1',
  org_id: null,
  aggregate_type: 'booking',
  aggregate_id: 'booking-1',
  event_type: 'tenant.webhooks.requested',
  payload: {
    bookingId: 'booking-1',
    hostUserId: 'profile-1',
  },
  dedupe_key: 'booking:booking-1:tenant-webhooks-requested',
  status: 'processing',
  available_at: '2026-05-08T00:00:00.000Z',
  attempts: 1,
  last_error: null,
  processed_at: null,
  created_at: '2026-05-08T00:00:00.000Z',
  updated_at: '2026-05-08T00:00:00.000Z',
}

describe('enqueueWebhookDeliveriesForOutboxEvent', () => {
  it('creates deliveries for subscribed active endpoints', async () => {
    const inserts: Array<Record<string, unknown>> = []
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'webhook_endpoints') {
          return {
            select: () => ({
              eq: () => ({
                eq: async () => ({
                  data: [
                    {
                      id: 'endpoint-1',
                      subscribed_events: ['booking.confirmed'],
                    },
                    {
                      id: 'endpoint-2',
                      subscribed_events: ['booking.cancelled'],
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'webhook_deliveries') {
          return {
            insert: async (payload: Record<string, unknown>) => {
              inserts.push(payload)
              return { error: null }
            },
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    } as any

    const result = await enqueueWebhookDeliveriesForOutboxEvent(
      adminClient,
      outboxEvent as any
    )

    expect(result).toEqual({
      queued: 1,
      duplicates: 0,
      skipped: 1,
      failed: 0,
    })
    expect(inserts).toEqual([
      {
        endpoint_id: 'endpoint-1',
        outbox_event_id: 'outbox-1',
        event_type: 'booking.confirmed',
        payload: {
          id: 'outbox-1',
          type: 'booking.confirmed',
          createdAt: '2026-05-08T00:00:00.000Z',
          data: {
            bookingId: 'booking-1',
            hostUserId: 'profile-1',
          },
        },
      },
    ])
  })
})

describe('processWebhookDeliveriesBatch', () => {
  it('signs and delivers claimed webhook deliveries', async () => {
    const updates: Array<Record<string, unknown>> = []
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }))
    const adminClient = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'delivery-1',
            endpoint_id: 'endpoint-1',
            outbox_event_id: 'outbox-1',
            event_type: 'booking.confirmed',
            payload: { id: 'outbox-1', type: 'booking.confirmed', data: {} },
            attempt_no: 1,
            status: 'processing',
            next_attempt_at: '2026-05-08T00:00:00.000Z',
            response_code: null,
            response_body: null,
            last_error: null,
            delivered_at: null,
            created_at: '2026-05-08T00:00:00.000Z',
            updated_at: '2026-05-08T00:00:00.000Z',
          },
        ],
        error: null,
      }),
      from: vi.fn((table: string) => {
        if (table === 'webhook_endpoints') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'endpoint-1',
                    url: 'https://example.com/webhook',
                    secret_token: 'secret',
                    is_active: true,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'webhook_deliveries') {
          return {
            update: (payload: Record<string, unknown>) => {
              updates.push(payload)
              return {
                eq: async () => ({ error: null }),
              }
            },
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    } as any

    const result = await processWebhookDeliveriesBatch({
      adminClient,
      fetchImpl: fetchImpl as any,
    })

    expect(result).toEqual({ claimed: 1, delivered: 1, failed: 0 })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-OpenSlot-Event': 'booking.confirmed',
          'X-OpenSlot-Delivery': 'delivery-1',
        }),
      })
    )
    expect(updates[0]).toMatchObject({
      status: 'delivered',
      response_code: 200,
      last_error: null,
    })
  })

  it('marks non-2xx deliveries as failed for retry', async () => {
    const updates: Array<Record<string, unknown>> = []
    const fetchImpl = vi.fn(async () => new Response('bad', { status: 500 }))
    const adminClient = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'delivery-1',
            endpoint_id: 'endpoint-1',
            outbox_event_id: 'outbox-1',
            event_type: 'booking.confirmed',
            payload: { id: 'outbox-1', type: 'booking.confirmed', data: {} },
            attempt_no: 1,
            status: 'processing',
            next_attempt_at: '2026-05-08T00:00:00.000Z',
            response_code: null,
            response_body: null,
            last_error: null,
            delivered_at: null,
            created_at: '2026-05-08T00:00:00.000Z',
            updated_at: '2026-05-08T00:00:00.000Z',
          },
        ],
        error: null,
      }),
      from: vi.fn((table: string) => {
        if (table === 'webhook_endpoints') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'endpoint-1',
                    url: 'https://example.com/webhook',
                    secret_token: 'secret',
                    is_active: true,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'webhook_deliveries') {
          return {
            update: (payload: Record<string, unknown>) => {
              updates.push(payload)
              return {
                eq: async () => ({ error: null }),
              }
            },
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    } as any

    const result = await processWebhookDeliveriesBatch({
      adminClient,
      fetchImpl: fetchImpl as any,
      maxAttempts: 5,
    })

    expect(result).toEqual({ claimed: 1, delivered: 0, failed: 1 })
    expect(updates[0]).toMatchObject({
      status: 'failed',
      response_code: 500,
      response_body: 'bad',
      last_error: 'Webhook endpoint returned HTTP 500',
    })
  })
})
