import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processOutboxBatch } from '../process'
import {
  sendBookingConfirmationToGuest,
  sendBookingNotificationToHost,
  sendBookingReminderEmail,
  sendCancellationEmail,
} from '@/lib/email/send'
import { processCalendarOutboxEvent } from '@/lib/calendar/events'

vi.mock('@/lib/email/send', () => ({
  sendBookingConfirmationToGuest: vi.fn().mockResolvedValue(undefined),
  sendBookingNotificationToHost: vi.fn().mockResolvedValue(undefined),
  sendBookingReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendCancellationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/calendar/events', () => ({
  processCalendarOutboxEvent: vi.fn().mockResolvedValue(undefined),
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

const validReminderPayload = {
  bookingId: 'booking-id-1',
  eventTypeId: 'event-type-1',
  hostUserId: 'host-user-1',
  startAt: '2026-06-15T14:00:00.000Z',
  endAt: '2026-06-15T14:30:00.000Z',
  reminderMinutesBefore: 60,
  channels: {
    guest: true,
    host: false,
  },
}

const malformedReminderPayloadCases: Array<
  [string, Record<string, unknown>, string]
> = [
  [
    'missing booking id',
    {
      ...validReminderPayload,
      bookingId: undefined,
    },
    'bookingId',
  ],
  [
    'missing timing fields',
    {
      ...validReminderPayload,
      startAt: undefined,
    },
    'startAt',
  ],
  [
    'missing channels',
    {
      ...validReminderPayload,
      channels: undefined,
    },
    'channels',
  ],
  [
    'invalid channel values',
    {
      ...validReminderPayload,
      channels: {
        guest: 'yes',
        host: false,
      },
    },
    'channels.guest',
  ],
  [
    'invalid lead time',
    {
      ...validReminderPayload,
      reminderMinutesBefore: 4,
    },
    'reminderMinutesBefore',
  ],
]

function createMockClient({
  events = [claimedEvent],
  handlerError = null,
  bookingOverrides = {},
}: {
  events?: Array<Record<string, unknown>>
  handlerError?: Error | null
  bookingOverrides?: Record<string, unknown>
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
                  ...bookingOverrides,
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

    expect(result).toEqual({ claimed: 1, completed: 1, deferred: 0, failed: 0 })
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

    expect(result).toEqual({ claimed: 1, completed: 0, deferred: 0, failed: 1 })
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
      deferred: 0,
      failed: 0,
    })
  })

  it('dispatches calendar provider events to the calendar handler', async () => {
    const calendarEvent = {
      ...claimedEvent,
      id: 'calendar-outbox-id',
      event_type: 'calendar.write.requested',
      dedupe_key: 'booking:booking-id-1:calendar-write-requested',
    }
    const { client } = createMockClient({ events: [calendarEvent] })

    const result = await processOutboxBatch({
      adminClient: client as any,
      maxAttempts: 5,
    })

    expect(result).toEqual({ claimed: 1, completed: 1, deferred: 0, failed: 0 })
    expect(processCalendarOutboxEvent).toHaveBeenCalledWith(
      client,
      calendarEvent
    )
  })

  it('defers booking notifications while generated conference links are pending without spending retry attempts', async () => {
    const { client, calls } = createMockClient({
      bookingOverrides: {
        location_type: 'video_provider',
        conference_provider: 'google_meet',
        conference_status: 'pending',
      },
    })

    const result = await processOutboxBatch({
      adminClient: client as any,
      maxAttempts: 5,
    })

    expect(result).toEqual({ claimed: 1, completed: 0, deferred: 1, failed: 0 })
    expect(sendBookingConfirmationToGuest).not.toHaveBeenCalled()
    expect(sendBookingNotificationToHost).not.toHaveBeenCalled()
    expect(calls.updates[0]).toMatchObject({
      status: 'pending',
      attempts: 0,
      last_error:
        'Conference link is not ready for booking booking-id-1: pending',
    })
  })

  it('sends cancellation notifications even when a generated conference link is pending', async () => {
    const cancelEvent = {
      ...claimedEvent,
      event_type: 'notifications.cancel.requested',
      dedupe_key: 'booking:booking-id-1:notifications-cancel-requested',
    }
    const { client, calls } = createMockClient({
      events: [cancelEvent],
      bookingOverrides: {
        location_type: 'video_provider',
        conference_provider: 'google_meet',
        conference_status: 'pending',
      },
    })

    const result = await processOutboxBatch({
      adminClient: client as any,
      maxAttempts: 5,
    })

    expect(result).toEqual({ claimed: 1, completed: 1, deferred: 0, failed: 0 })
    expect(sendCancellationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-id-1' }),
      'guest'
    )
    expect(sendCancellationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-id-1' }),
      'host'
    )
    expect(calls.updates[0]).toMatchObject({
      status: 'completed',
      last_error: null,
    })
  })

  it('sends due reminder notifications to enabled channels', async () => {
    const reminderEvent = {
      ...claimedEvent,
      id: 'reminder-outbox-id',
      event_type: 'notifications.reminder.requested',
      dedupe_key: 'booking:booking-id-1:notifications-reminder-requested',
      payload: validReminderPayload,
    }
    const { client } = createMockClient({ events: [reminderEvent] })

    const result = await processOutboxBatch({
      adminClient: client as any,
      maxAttempts: 5,
    })

    expect(result).toEqual({ claimed: 1, completed: 1, deferred: 0, failed: 0 })
    expect(sendBookingReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-id-1',
        eventTitle: 'Intro Call',
      }),
      'guest',
      60
    )
    expect(sendBookingReminderEmail).toHaveBeenCalledTimes(1)
  })

  it.each(malformedReminderPayloadCases)(
    'fails malformed reminder payloads with %s',
    async (_caseName, payload, path) => {
      const reminderEvent = {
        ...claimedEvent,
        id: 'reminder-outbox-id',
        event_type: 'notifications.reminder.requested',
        dedupe_key: 'booking:booking-id-1:notifications-reminder-requested',
        payload,
      }
      const { client, calls } = createMockClient({ events: [reminderEvent] })

      const result = await processOutboxBatch({
        adminClient: client as any,
        maxAttempts: 5,
      })

      expect(result).toEqual({ claimed: 1, completed: 0, deferred: 0, failed: 1 })
      expect(sendBookingReminderEmail).not.toHaveBeenCalled()
      expect(calls.updates[0]).toMatchObject({
        status: 'failed',
        last_error: expect.stringContaining(path),
      })
    }
  )

  it.each(['cancelled', 'rescheduled'])(
    'skips stale reminders for %s bookings',
    async (bookingStatus) => {
      const reminderEvent = {
        ...claimedEvent,
        id: 'reminder-outbox-id',
        event_type: 'notifications.reminder.requested',
        dedupe_key: 'booking:booking-id-1:notifications-reminder-requested',
        payload: {
          ...validReminderPayload,
          channels: {
            guest: true,
            host: true,
          },
        },
      }
      const { client, calls } = createMockClient({
        events: [reminderEvent],
        bookingOverrides: {
          status: bookingStatus,
        },
      })

      const result = await processOutboxBatch({
        adminClient: client as any,
        maxAttempts: 5,
      })

      expect(result).toEqual({ claimed: 1, completed: 1, deferred: 0, failed: 0 })
      expect(sendBookingReminderEmail).not.toHaveBeenCalled()
      expect(calls.updates[0]).toMatchObject({
        status: 'completed',
        last_error: null,
      })
    }
  )

  it('skips reminders whose scheduled time no longer matches the booking', async () => {
    const reminderEvent = {
      ...claimedEvent,
      id: 'reminder-outbox-id',
      event_type: 'notifications.reminder.requested',
      dedupe_key: 'booking:booking-id-1:notifications-reminder-requested',
      payload: {
        ...validReminderPayload,
        channels: {
          guest: true,
          host: true,
        },
      },
    }
    const { client } = createMockClient({
      events: [reminderEvent],
      bookingOverrides: {
        start_at: '2026-06-16T14:00:00.000Z',
        end_at: '2026-06-16T14:30:00.000Z',
      },
    })

    const result = await processOutboxBatch({
      adminClient: client as any,
      maxAttempts: 5,
    })

    expect(result).toEqual({ claimed: 1, completed: 1, deferred: 0, failed: 0 })
    expect(sendBookingReminderEmail).not.toHaveBeenCalled()
  })
})
