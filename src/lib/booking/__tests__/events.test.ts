import { describe, expect, it, vi } from 'vitest'
import { appendBookingEvent } from '../events'

function createMockClient(error: { code?: string; message: string } | null = null) {
  const calls = {
    insertPayload: null as Record<string, unknown> | null,
  }

  const client = {
    from: vi.fn(() => ({
      insert: vi.fn(async (payload: Record<string, unknown>) => {
        calls.insertPayload = payload
        return { error }
      }),
    })),
  }

  return { client, calls }
}

describe('appendBookingEvent', () => {
  it('inserts a booking event with a system actor by default', async () => {
    const { client, calls } = createMockClient()

    const result = await appendBookingEvent(client as any, {
      bookingId: 'booking-id-1',
      eventType: 'booking.confirmed',
      payload: { eventTypeId: 'event-type-1' },
    })

    expect(result).toBe(true)
    expect(client.from).toHaveBeenCalledWith('booking_events')
    expect(calls.insertPayload).toEqual({
      booking_id: 'booking-id-1',
      event_type: 'booking.confirmed',
      actor_type: 'system',
      actor_id: null,
      payload: { eventTypeId: 'event-type-1' },
    })
  })

  it('logs failures without throwing', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { client } = createMockClient({
      code: '42501',
      message: 'permission denied',
    })

    const result = await appendBookingEvent(client as any, {
      bookingId: 'booking-id-1',
      eventType: 'booking.cancelled',
    })

    expect(result).toBe(false)
    expect(consoleError).toHaveBeenCalledWith(
      'Error appending booking event:',
      expect.objectContaining({
        code: '42501',
        bookingId: 'booking-id-1',
        eventType: 'booking.cancelled',
      })
    )

    consoleError.mockRestore()
  })
})
