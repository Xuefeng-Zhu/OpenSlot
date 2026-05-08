import { describe, expect, it, vi } from 'vitest'
import {
  createProviderCalendarEvent,
  deleteProviderCalendarEvent,
} from '../provider-sync'

describe('calendar provider event sync', () => {
  it('creates Google Calendar events and returns provider references', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'provider-event-1',
          htmlLink: 'https://calendar.google.com/event',
          etag: 'etag-1',
        }),
        { status: 200 }
      )
    )

    const result = await createProviderCalendarEvent({
      provider: 'google',
      accessToken: 'access-token',
      externalCalendarId: 'primary',
      event: {
        bookingId: 'booking-1',
        title: 'Intro Call',
        description: 'Booked through OpenSlot',
        startAt: '2026-06-15T14:00:00.000Z',
        endAt: '2026-06-15T14:30:00.000Z',
        guestName: 'Jane Guest',
        guestEmail: 'jane@example.com',
      },
      fetchImpl: fetchImpl as typeof fetch,
    })

    expect(result).toEqual({
      externalEventId: 'provider-event-1',
      providerEventUrl: 'https://calendar.google.com/event',
      metadata: { etag: 'etag-1' },
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events'
        ),
      }),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('treats missing provider events as already deleted', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }))

    await expect(
      deleteProviderCalendarEvent({
        provider: 'microsoft',
        accessToken: 'access-token',
        externalCalendarId: 'calendar-1',
        externalEventId: 'event-1',
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).resolves.toBeUndefined()
  })
})
