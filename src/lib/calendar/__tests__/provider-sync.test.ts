import { describe, expect, it, vi } from 'vitest'
import {
  createProviderCalendarEvent,
  deleteProviderCalendarEvent,
  refreshCalendarAvailabilityForHost,
  syncCalendarsForConnection,
} from '../provider-sync'

vi.mock('@/lib/security/token-encryption', () => ({
  decryptToken: vi.fn(() => 'access-token'),
  encryptToken: vi.fn((value: string) => `encrypted:${value}`),
}))

function createSyncQuery({
  table,
  resultFor,
}: {
  table: string
  resultFor: (query: {
    table: string
    operation: string | null
    payload: unknown
    filters: Array<{ column: string; value: unknown }>
  }) => { data: unknown; error: { message: string } | null }
}) {
  const state: {
    table: string
    operation: string | null
    payload: unknown
    filters: Array<{ column: string; value: unknown }>
  } = {
    table,
    operation: null,
    payload: null,
    filters: [],
  }
  const query: any = {
    select: vi.fn(() => {
      state.operation = 'select'
      return query
    }),
    update: vi.fn((payload: unknown) => {
      state.operation = 'update'
      state.payload = payload
      return query
    }),
    insert: vi.fn((payload: unknown) => {
      state.operation = 'insert'
      state.payload = payload
      return query
    }),
    delete: vi.fn(() => {
      state.operation = 'delete'
      return query
    }),
    eq: vi.fn((column: string, value: unknown) => {
      state.filters.push({ column, value })
      return query
    }),
    gt: vi.fn((column: string, value: unknown) => {
      state.filters.push({ column, value })
      return query
    }),
    gte: vi.fn((column: string, value: unknown) => {
      state.filters.push({ column, value })
      return query
    }),
    in: vi.fn((column: string, value: unknown) => {
      state.filters.push({ column, value })
      return query
    }),
    limit: vi.fn(() => query),
    lt: vi.fn((column: string, value: unknown) => {
      state.filters.push({ column, value })
      return query
    }),
    single: vi.fn(async () => resultFor(state)),
    then: (
      resolve: (
        value: { data: unknown; error: { message: string } | null }
      ) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(resultFor(state)).then(resolve, reject),
  }

  return query
}

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

  it('stores Google all-day busy events in the provider calendar timezone', async () => {
    const insertedBusyRows: unknown[] = []
    const connection = {
      id: 'connection-1',
      profile_id: 'profile-1',
      provider: 'google',
      account_email: 'host@example.com',
      scopes: [],
      access_token_encrypted: 'encrypted-access-token',
      refresh_token_encrypted: null,
      token_expires_at: '2099-01-01T00:00:00.000Z',
      status: 'active',
      metadata: {},
      connected_at: '2026-06-01T00:00:00.000Z',
      last_synced_at: null,
      last_error: null,
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    }
    const calendar = {
      id: 'calendar-1',
      connection_id: 'connection-1',
      external_calendar_id: 'primary',
      summary: 'Primary',
      timezone: 'America/Los_Angeles',
      is_primary: true,
      use_for_availability: true,
      use_for_writes: true,
      metadata: {},
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    }
    const adminClient = {
      from: vi.fn((table: string) =>
        createSyncQuery({
          table,
          resultFor: (query) => {
            if (query.table === 'provider_connections') {
              return { data: query.operation === 'select' ? connection : null, error: null }
            }

            if (query.table === 'provider_calendars') {
              return { data: [calendar], error: null }
            }

            if (
              query.table === 'external_busy_cache' &&
              query.operation === 'insert'
            ) {
              insertedBusyRows.push(...((query.payload as unknown[]) ?? []))
            }

            return { data: null, error: null }
          },
        })
      ),
    }
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'primary',
                summary: 'Primary',
                timeZone: 'America/Los_Angeles',
                primary: true,
                accessRole: 'owner',
              },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'all-day-busy',
                start: { date: '2026-06-15' },
                end: { date: '2026-06-16' },
              },
            ],
          }),
          { status: 200 }
        )
      )

    await syncCalendarsForConnection(
      adminClient as any,
      'connection-1',
      fetchImpl as typeof fetch,
      {
        windowStart: '2026-06-14T00:00:00.000Z',
        windowEnd: '2026-06-17T00:00:00.000Z',
      }
    )

    expect(insertedBusyRows).toEqual([
      expect.objectContaining({
        provider_calendar_id: 'calendar-1',
        source_event_id: 'all-day-busy',
        start_at: '2026-06-15T07:00:00.000Z',
        end_at: '2026-06-16T07:00:00.000Z',
      }),
    ])
  })

  it('does not mark a provider connection unhealthy when sync is aborted', async () => {
    const connectionUpdates: unknown[] = []
    const connection = {
      id: 'connection-1',
      profile_id: 'profile-1',
      provider: 'google',
      account_email: 'host@example.com',
      scopes: [],
      access_token_encrypted: 'encrypted-access-token',
      refresh_token_encrypted: null,
      token_expires_at: '2099-01-01T00:00:00.000Z',
      status: 'active',
      metadata: {},
      connected_at: '2026-06-01T00:00:00.000Z',
      last_synced_at: null,
      last_error: null,
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    }
    const adminClient = {
      from: vi.fn((table: string) =>
        createSyncQuery({
          table,
          resultFor: (query) => {
            if (query.table === 'provider_connections') {
              if (query.operation === 'update') {
                connectionUpdates.push(query.payload)
              }

              return {
                data: query.operation === 'select' ? connection : null,
                error: null,
              }
            }

            return { data: null, error: null }
          },
        })
      ),
    }
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    const fetchImpl = vi.fn(async () => {
      throw abortError
    })

    await expect(
      syncCalendarsForConnection(
        adminClient as any,
        'connection-1',
        fetchImpl as typeof fetch
      )
    ).rejects.toBe(abortError)
    expect(connectionUpdates).toEqual([])
  })

  it('skips far-future on-demand availability refresh when the cache is fresh', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'))

    try {
      const fetchImpl = vi.fn()
      const adminClient = {
        from: vi.fn((table: string) =>
          createSyncQuery({
            table,
            resultFor: () => ({
              data: [
                {
                  id: 'connection-1',
                  status: 'active',
                  last_synced_at: '2026-06-01T11:58:00.000Z',
                  updated_at: '2026-06-01T11:58:00.000Z',
                },
              ],
              error: null,
            }),
          })
        ),
      }

      const result = await refreshCalendarAvailabilityForHost(
        adminClient as any,
        'profile-1',
        '2026-09-30T00:00:00.000Z',
        '2026-10-01T00:00:00.000Z',
        fetchImpl as typeof fetch
      )

      expect(result).toEqual({ checked: 1, refreshed: 0, failed: 0 })
      expect(fetchImpl).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
