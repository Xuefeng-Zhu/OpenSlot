import { describe, expect, it, vi } from 'vitest'
import {
  getCancellationDetails,
  isValidCancellationToken,
} from '../cancellation-details'

const validToken = '11111111-1111-4111-8111-111111111111'

const confirmedBooking = {
  id: 'booking-1',
  event_type_id: 'event-type-1',
  host_user_id: 'host-1',
  guest_name: 'Jane Doe',
  guest_timezone: 'America/New_York',
  start_at: '2026-05-15T14:00:00Z',
  end_at: '2026-05-15T14:30:00Z',
  status: 'confirmed',
  cancellation_token: validToken,
  updated_at: '2026-05-14T12:00:00Z',
}

function createMockClient({
  booking = confirmedBooking,
  bookingError = null,
  eventTitle = 'Intro Call',
  hostName = 'Sarah Chen',
}: {
  booking?: typeof confirmedBooking | null
  bookingError?: { code?: string; message: string } | null
  eventTitle?: string | null
  hostName?: string | null
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: booking,
                error: bookingError,
              }),
            }),
          }),
        }
      }

      if (table === 'event_types') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: eventTitle ? { title: eventTitle } : null,
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: hostName ? { name: hostName } : null,
                error: null,
              }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('isValidCancellationToken', () => {
  it('accepts UUID cancellation tokens', () => {
    expect(isValidCancellationToken(validToken)).toBe(true)
  })

  it('rejects malformed cancellation tokens', () => {
    expect(isValidCancellationToken('not-a-token')).toBe(false)
  })
})

describe('getCancellationDetails', () => {
  it('returns active booking details for a confirmed booking token', async () => {
    const client = createMockClient({})

    const result = await getCancellationDetails(validToken, client as any)

    expect(result).toEqual({
      status: 'active',
      booking: {
        bookingId: 'booking-1',
        cancellationToken: validToken,
        eventTitle: 'Intro Call',
        hostName: 'Sarah Chen',
        guestName: 'Jane Doe',
        startAt: '2026-05-15T14:00:00Z',
        endAt: '2026-05-15T14:30:00Z',
        guestTimezone: 'America/New_York',
        cancelledAt: undefined,
      },
    })
  })

  it('returns already-cancelled details using updated_at as the cancellation timestamp', async () => {
    const client = createMockClient({
      booking: {
        ...confirmedBooking,
        status: 'cancelled',
        updated_at: '2026-05-14T16:45:00Z',
      },
    })

    const result = await getCancellationDetails(validToken, client as any)

    expect(result).toEqual({
      status: 'already-cancelled',
      booking: expect.objectContaining({
        bookingId: 'booking-1',
        cancelledAt: '2026-05-14T16:45:00Z',
      }),
    })
  })

  it('does not query the backend for malformed tokens', async () => {
    const client = createMockClient({})

    const result = await getCancellationDetails('not-a-token', client as any)

    expect(result).toEqual({ status: 'invalid' })
    expect(client.from).not.toHaveBeenCalled()
  })

  it('returns invalid when the token does not match a booking', async () => {
    const client = createMockClient({
      booking: null,
      bookingError: { code: 'PGRST116', message: 'No rows found' },
    })

    const result = await getCancellationDetails(validToken, client as any)

    expect(result).toEqual({ status: 'invalid' })
  })

  it('uses safe fallback labels when event or host records are missing', async () => {
    const client = createMockClient({
      eventTitle: null,
      hostName: null,
    })

    const result = await getCancellationDetails(validToken, client as any)

    expect(result).toEqual({
      status: 'active',
      booking: expect.objectContaining({
        eventTitle: 'Meeting',
        hostName: 'Host',
      }),
    })
  })
})
