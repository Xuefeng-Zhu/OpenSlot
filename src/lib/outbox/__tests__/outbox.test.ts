import { describe, expect, it, vi } from 'vitest'
import {
  enqueueBookingCancelledOutbox,
  enqueueBookingConfirmedOutbox,
  enqueueOutboxEvents,
} from '../outbox'

function createMockClient(errors: Array<{ code?: string; message: string } | null>) {
  const calls = {
    inserts: [] as Array<Record<string, unknown>>,
  }

  const insert = vi.fn(async (payload: Record<string, unknown>) => {
    calls.inserts.push(payload)
    return { error: errors.shift() ?? null }
  })

  const client = {
    from: vi.fn(() => ({
      insert,
    })),
  }

  return { client, calls, insert }
}

describe('enqueueOutboxEvents', () => {
  it('inserts outbox events with deterministic dedupe keys', async () => {
    const { client, calls } = createMockClient([null])

    const result = await enqueueOutboxEvents(client as any, [
      {
        aggregateType: 'booking',
        aggregateId: 'booking-id-1',
        eventType: 'booking.confirmed',
        payload: { bookingId: 'booking-id-1' },
        dedupeKey: 'booking:booking-id-1:confirmed',
      },
    ])

    expect(result).toEqual({ queued: 1, duplicates: 0, failed: 0 })
    expect(client.from).toHaveBeenCalledWith('outbox_events')
    expect(calls.inserts[0]).toMatchObject({
      aggregate_type: 'booking',
      aggregate_id: 'booking-id-1',
      event_type: 'booking.confirmed',
      payload: { bookingId: 'booking-id-1' },
      dedupe_key: 'booking:booking-id-1:confirmed',
    })
  })

  it('treats duplicate dedupe keys as already queued', async () => {
    const { client } = createMockClient([
      { code: '23505', message: 'duplicate key value violates unique constraint' },
    ])

    const result = await enqueueOutboxEvents(client as any, [
      {
        aggregateType: 'booking',
        aggregateId: 'booking-id-1',
        eventType: 'booking.confirmed',
        dedupeKey: 'booking:booking-id-1:confirmed',
      },
    ])

    expect(result).toEqual({ queued: 0, duplicates: 1, failed: 0 })
  })

  it('logs non-duplicate failures without throwing', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { client } = createMockClient([
      { code: '42501', message: 'permission denied for table outbox_events' },
    ])

    const result = await enqueueOutboxEvents(client as any, [
      {
        aggregateType: 'booking',
        aggregateId: 'booking-id-1',
        eventType: 'booking.confirmed',
        dedupeKey: 'booking:booking-id-1:confirmed',
      },
    ])

    expect(result).toEqual({ queued: 0, duplicates: 0, failed: 1 })
    expect(consoleError).toHaveBeenCalledWith(
      'Error enqueueing outbox event:',
      expect.objectContaining({
        code: '42501',
        message: 'permission denied for table outbox_events',
        eventType: 'booking.confirmed',
        aggregateId: 'booking-id-1',
      })
    )

    consoleError.mockRestore()
  })
})

describe('booking outbox helpers', () => {
  const booking = {
    bookingId: 'booking-id-1',
    eventTypeId: 'event-type-1',
    hostUserId: 'host-user-1',
    startAt: '2025-01-15T14:00:00Z',
    endAt: '2025-01-15T14:30:00Z',
  }

  it('enqueues the booking confirmation side-effect set', async () => {
    const { client, calls } = createMockClient([null, null, null, null])

    const result = await enqueueBookingConfirmedOutbox(client as any, booking)

    expect(result).toEqual({ queued: 4, duplicates: 0, failed: 0 })
    expect(calls.inserts.map((call) => call.event_type)).toEqual([
      'booking.confirmed',
      'calendar.write.requested',
      'notifications.requested',
      'tenant.webhooks.requested',
    ])
    expect(calls.inserts.map((call) => call.dedupe_key)).toEqual([
      'booking:booking-id-1:confirmed',
      'booking:booking-id-1:calendar-write-requested',
      'booking:booking-id-1:notifications-requested',
      'booking:booking-id-1:tenant-webhooks-requested',
    ])
  })

  it('enqueues the booking cancellation side-effect set', async () => {
    const { client, calls } = createMockClient([null, null, null, null])

    const result = await enqueueBookingCancelledOutbox(client as any, {
      ...booking,
      cancelReasonProvided: true,
    })

    expect(result).toEqual({ queued: 4, duplicates: 0, failed: 0 })
    expect(calls.inserts.map((call) => call.event_type)).toEqual([
      'booking.cancelled',
      'calendar.cancel.requested',
      'notifications.cancel.requested',
      'tenant.webhooks.cancel.requested',
    ])
    expect(calls.inserts[0].payload).toMatchObject({
      bookingId: 'booking-id-1',
      eventTypeId: 'event-type-1',
      hostUserId: 'host-user-1',
      cancelReasonProvided: true,
    })
  })
})
