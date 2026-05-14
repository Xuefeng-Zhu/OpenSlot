import { describe, expect, it, vi } from 'vitest'
import {
  createProviderCalendarEvent,
  deleteProviderCalendarEvent,
} from '../provider-sync'

describe('calendar provider event sync', () => {
  it('creates Google Calendar events and returns provider references', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
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
      conferenceUrl: null,
      metadata: {
        etag: 'etag-1',
        conferenceProvider: null,
        conferenceUrl: null,
        conferenceStatus: null,
      },
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

  it('requests Google Meet links when the booking uses Google Meet', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          id: 'provider-event-1',
          htmlLink: 'https://calendar.google.com/event',
          hangoutLink: 'https://meet.google.com/aaa-bbbb-ccc',
          etag: 'etag-1',
          conferenceData: {
            entryPoints: [
              {
                entryPointType: 'video',
                uri: 'https://meet.google.com/aaa-bbbb-ccc',
              },
            ],
            createRequest: { status: { statusCode: 'success' } },
          },
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
        conferenceProvider: 'google_meet',
      },
      fetchImpl: fetchImpl as typeof fetch,
    })
    const [url, request] = fetchImpl.mock.calls[0]
    const body = JSON.parse((request as RequestInit).body as string)

    expect((url as URL).searchParams.get('conferenceDataVersion')).toBe('1')
    expect(body.conferenceData.createRequest).toMatchObject({
      requestId: 'openslot-booking-1',
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    })
    expect(result.conferenceUrl).toBe('https://meet.google.com/aaa-bbbb-ccc')
  })

  it('requests Microsoft Teams links when the booking uses Teams', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          id: 'provider-event-1',
          webLink: 'https://outlook.office.com/event',
          changeKey: 'change-key-1',
          onlineMeeting: {
            joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc',
          },
        }),
        { status: 200 }
      )
    )

    const result = await createProviderCalendarEvent({
      provider: 'microsoft',
      accessToken: 'access-token',
      externalCalendarId: 'calendar-1',
      event: {
        bookingId: 'booking-1',
        title: 'Intro Call',
        description: 'Booked through OpenSlot',
        startAt: '2026-06-15T14:00:00.000Z',
        endAt: '2026-06-15T14:30:00.000Z',
        guestName: 'Jane Guest',
        guestEmail: 'jane@example.com',
        conferenceProvider: 'microsoft_teams',
      },
      fetchImpl: fetchImpl as typeof fetch,
    })
    const body = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string)

    expect(body).toMatchObject({
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    })
    expect(result.conferenceUrl).toBe(
      'https://teams.microsoft.com/l/meetup-join/abc'
    )
  })

  it('treats missing provider events as already deleted', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response('', { status: 404 })
    )

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
