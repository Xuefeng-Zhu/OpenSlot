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

const claimedDelivery = {
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
}

function createDeliveryAdminClient(
  endpointUrl: string,
  updates: Array<Record<string, unknown>>
) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: [claimedDelivery], error: null }),
    from: vi.fn((table: string) => {
      if (table === 'webhook_endpoints') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'endpoint-1',
                  url: endpointUrl,
                  secret_token: 'secret',
                  is_active: true,
                },
                error: null,
              }),
            }),
          }),
        }
      }

      return {
        update: (payload: Record<string, unknown>) => {
          updates.push(payload)
          return { eq: async () => ({ error: null }) }
        },
      }
    }),
  } as any
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
  it('rejects an unsafe persisted endpoint before making a network request', async () => {
    const updates: Array<Record<string, unknown>> = []
    const fetchImpl = vi.fn()
    const adminClient = {
      rpc: vi.fn().mockResolvedValue({ data: [claimedDelivery], error: null }),
      from: vi.fn((table: string) => {
        if (table === 'webhook_endpoints') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'endpoint-1',
                    url: 'http://[::ffff:127.0.0.1]/webhook',
                    secret_token: 'secret',
                    is_active: true,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }

        return {
          update: (payload: Record<string, unknown>) => {
            updates.push(payload)
            return { eq: async () => ({ error: null }) }
          },
        }
      }),
    } as any

    const result = await processWebhookDeliveriesBatch({
      adminClient,
      fetchImpl: fetchImpl as any,
    })

    expect(result).toEqual({ claimed: 1, delivered: 0, failed: 1 })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(updates[0]).toMatchObject({
      status: 'failed',
      last_error: 'Webhook endpoint URL is not allowed',
    })
  })

  it('rejects an unsafe redirect target before requesting it', async () => {
    const updates: Array<Record<string, unknown>> = []
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 307,
        headers: { Location: 'http://127.0.0.1/internal' },
      })
    )
    const adminClient = {
      rpc: vi.fn().mockResolvedValue({ data: [claimedDelivery], error: null }),
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

        return {
          update: (payload: Record<string, unknown>) => {
            updates.push(payload)
            return { eq: async () => ({ error: null }) }
          },
        }
      }),
    } as any

    const result = await processWebhookDeliveriesBatch({
      adminClient,
      fetchImpl: fetchImpl as any,
    })

    expect(result).toEqual({ claimed: 1, delivered: 0, failed: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({ redirect: 'manual' })
    )
    expect(updates[0]).toMatchObject({
      status: 'failed',
      last_error: 'Webhook redirect URL is not allowed',
    })
  })

  it.each([301, 302, 303])(
    'changes POST redirects to GET for HTTP %i responses',
    async (status) => {
      const updates: Array<Record<string, unknown>> = []
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status,
            headers: { Location: '/completed' },
          })
        )
        .mockResolvedValueOnce(new Response('ok', { status: 200 }))
      const adminClient = createDeliveryAdminClient(
        'https://example.com/webhook',
        updates
      )

      const result = await processWebhookDeliveriesBatch({
        adminClient,
        fetchImpl: fetchImpl as any,
      })

      expect(result).toEqual({ claimed: 1, delivered: 1, failed: 0 })
      expect(fetchImpl).toHaveBeenNthCalledWith(
        2,
        'https://example.com/completed',
        expect.objectContaining({
          method: 'GET',
          body: undefined,
          redirect: 'manual',
        })
      )
      const redirectedHeaders = new Headers(
        fetchImpl.mock.calls[1][1]?.headers
      )
      expect(redirectedHeaders.has('content-type')).toBe(false)
    }
  )

  it.each([307, 308])(
    'preserves POST and its body across HTTP %i redirects',
    async (status) => {
      const updates: Array<Record<string, unknown>> = []
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status,
            headers: { Location: '/moved' },
          })
        )
        .mockResolvedValueOnce(new Response('ok', { status: 200 }))
      const adminClient = createDeliveryAdminClient(
        'https://example.com/webhook',
        updates
      )

      const result = await processWebhookDeliveriesBatch({
        adminClient,
        fetchImpl: fetchImpl as any,
      })

      expect(result).toEqual({ claimed: 1, delivered: 1, failed: 0 })
      expect(fetchImpl).toHaveBeenNthCalledWith(
        2,
        'https://example.com/moved',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(claimedDelivery.payload),
          redirect: 'manual',
        })
      )
    }
  )

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
