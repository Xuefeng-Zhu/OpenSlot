import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processOutboxBatch } from '../process'
import {
  sendBookingConfirmationToGuest,
  sendBookingNotificationToHost,
} from '@/lib/email/send'

vi.mock('@/lib/email/send', () => ({
  sendBookingConfirmationToGuest: vi.fn().mockResolvedValue(undefined),
  sendBookingNotificationToHost: vi.fn().mockResolvedValue(undefined),
  sendCancellationEmail: vi.fn().mockResolvedValue(undefined),
}))

const claimedEvent = {
  id: 'outbox-id-1',
  org_id: null,
  aggregate_type: 'booking',
  aggregate_id: 'booking-id-1',
  event_type: 'notifications.requested',
  payload: { bookingId: 'booking-id-1' },
  dedupe_key: 'booking:booking-id-1:notifications-requested',
  status: 'processing',
  available_at: '2026-01-01T00:00:00.000Z',
  attempts: 1,
  last_error: null,
  processed_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

function createMockClient({
  events = [claimedEvent],
  handlerError = null,
}: {
  events?: Array<Record<string, unknown>>
  handlerError?: Error | null
} = {}) {
  const calls = {
    updates: [] as Array<Record<string, unknown>>,
  }

  const client = {
    rpc: vi.fn(async () => ({
      data: events,
      error: null,
    })),
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            if (table === 'bookings') {
              return {
                data: {
                  id: 'booking-id-1',
                  event_type_id: 'event-type-1',
                  host_user_id: 'host-user-1',
                  guest_name: 'Jane Guest',
                  guest_email: 'jane@example.com',
                  guest_timezone: 'America/New_York',
                  notes: '',
                  start_at: '2026-06-15T14:00:00.000Z',
                  end_at: '2026-06-15T14:30:00.000Z',
                  status: 'confirmed',
                  cancel_reason: null,
                  cancellation_token: 'cancel-token',
                  reschedule_token: 'reschedule-token',
                  created_at: '2026-06-01T00:00:00.000Z',
                  updated_at: '2026-06-01T00:00:00.000Z',
                },
                error: null,
              }
            }

            if (table === 'event_types') {
              return { data: { title: 'Intro Call' }, error: null }
            }

            if (table === 'profiles') {
              return { data: { name: 'Host User', email: 'host@example.com' }, error: null }
            }

            return { data: null, error: { message: 'unexpected table' } }
          },
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        calls.updates.push(payload)
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        }
      },
    })),
  }

  if (handlerError) {
    vi.mocked(sendBookingConfirmationToGuest).mockRejectedValueOnce(handlerError)
  }

  return { client, calls }
}

describe('processOutboxBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('claims notification events, sends emails, and marks them completed', async () => {
    const { client, calls } = createMockClient()

    const result = await processOutboxBatch({
      adminClient: client as any,
      limit: 3,
      maxAttempts: 5,
    })

    expect(result).toEqual({ claimed: 1, completed: 1, failed: 0 })
    expect(client.rpc).toHaveBeenCalledWith('claim_outbox_events', {
      p_limit: 3,
      p_max_attempts: 5,
    })
    expect(sendBookingConfirmationToGuest).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-id-1',
        eventTitle: 'Intro Call',
        hostEmail: 'host@example.com',
      })
    )
    expect(sendBookingNotificationToHost).toHaveBeenCalled()
    expect(calls.updates[0]).toMatchObject({
      status: 'completed',
      last_error: null,
    })
  })

  it('marks a claimed event failed when its handler throws', async () => {
    const { client, calls } = createMockClient({
      handlerError: new Error('email provider down'),
    })

    const result = await processOutboxBatch({
      adminClient: client as any,
      maxAttempts: 5,
    })

    expect(result).toEqual({ claimed: 1, completed: 0, failed: 1 })
    expect(calls.updates[0]).toMatchObject({
      status: 'failed',
      last_error: 'email provider down',
    })
    expect(calls.updates[0].available_at).toEqual(expect.any(String))
  })

  it('returns empty stats when there is no claimable work', async () => {
    const { client } = createMockClient({ events: [] })

    await expect(
      processOutboxBatch({ adminClient: client as any })
    ).resolves.toEqual({
      claimed: 0,
      completed: 0,
      failed: 0,
    })
  })
})
