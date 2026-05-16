import { afterEach, describe, expect, it, vi } from 'vitest'
import { processOutboxBatch } from '../process'

const originalEmailEnv = {
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
  EMAIL_FROM: process.env.EMAIL_FROM,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
}

afterEach(() => {
  process.env.EMAIL_PROVIDER = originalEmailEnv.EMAIL_PROVIDER
  process.env.EMAIL_FROM = originalEmailEnv.EMAIL_FROM
  process.env.RESEND_API_KEY = originalEmailEnv.RESEND_API_KEY
  vi.unstubAllGlobals()
})

const notificationEvent = {
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

function createOutboxClient() {
  const updates: Array<Record<string, unknown>> = []

  const client = {
    rpc: vi.fn(async () => ({
      data: [notificationEvent],
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
                  rescheduled_from_booking_id: null,
                  rescheduled_to_booking_id: null,
                  rescheduled_at: null,
                  location_type: 'custom',
                  location_value: 'https://example.com/meeting',
                  conference_provider: null,
                  conference_url: null,
                  conference_status: 'not_required',
                  conference_error: null,
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
        updates.push(payload)
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        }
      },
    })),
  }

  return { client, updates }
}

describe('processOutboxBatch email delivery failures', () => {
  it('marks notification work failed when the real provider reports an unsuccessful send', async () => {
    process.env.EMAIL_PROVIDER = 'resend'
    process.env.EMAIL_FROM = 'OpenSlot <bookings@example.com>'
    process.env.RESEND_API_KEY = 'resend-key'
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'Provider down' }), {
        status: 503,
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { client, updates } = createOutboxClient()

    const result = await processOutboxBatch({
      adminClient: client as any,
      maxAttempts: 5,
    })

    expect(result).toEqual({ claimed: 1, completed: 0, deferred: 0, failed: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(updates[0]).toMatchObject({
      status: 'failed',
      last_error: 'Booking confirmation email to guest failed: Provider down',
    })
    expect(updates[0]).not.toHaveProperty('processed_at')
  })
})
