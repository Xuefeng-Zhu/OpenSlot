import { describe, expect, it, vi } from 'vitest'
import {
  listWebhookEndpointSummaries,
  toWebhookEndpointSummary,
} from '../endpoints'

describe('webhook endpoint summaries', () => {
  it('maps endpoint rows without exposing secret tokens', () => {
    const summary = toWebhookEndpointSummary({
      id: 'endpoint-1',
      url: 'https://example.com/webhook',
      description: 'Production',
      subscribed_events: ['booking.confirmed'],
      is_active: true,
      created_at: '2026-05-08T00:00:00.000Z',
      updated_at: '2026-05-08T00:00:00.000Z',
    })

    expect(summary).toEqual({
      id: 'endpoint-1',
      url: 'https://example.com/webhook',
      description: 'Production',
      subscribedEvents: ['booking.confirmed'],
      isActive: true,
      createdAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z',
    })
    expect(JSON.stringify(summary)).not.toContain('secret')
  })

  it('loads endpoint summaries scoped to a profile', async () => {
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table !== 'webhook_endpoints') {
          throw new Error(`Unexpected table: ${table}`)
        }

        return {
          select: () => ({
            eq: (_column: string, profileId: string) => ({
              order: async () => ({
                data: [
                  {
                    id: 'endpoint-1',
                    url: 'https://example.com/webhook',
                    description: profileId,
                    subscribed_events: ['*'],
                    is_active: false,
                    created_at: '2026-05-08T00:00:00.000Z',
                    updated_at: '2026-05-08T00:00:00.000Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
        }
      }),
    } as any

    await expect(
      listWebhookEndpointSummaries(adminClient, 'profile-1')
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'endpoint-1',
        description: 'profile-1',
        subscribedEvents: ['*'],
        isActive: false,
      }),
    ])
  })
})
