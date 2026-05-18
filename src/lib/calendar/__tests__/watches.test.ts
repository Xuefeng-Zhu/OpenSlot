import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureCalendarWatchesForConnection,
  handleGoogleCalendarWebhook,
  handleMicrosoftCalendarWebhook,
} from '../watches'
import { refreshProviderCalendarBusyCache } from '../provider-sync'

vi.mock('../provider-sync', () => ({
  DEFAULT_BUSY_SYNC_WINDOW_MS: 90 * 24 * 60 * 60 * 1000,
  getFreshAccessToken: vi.fn(async () => 'access-token'),
  refreshProviderCalendarBusyCache: vi.fn(async () => undefined),
}))

function createQuery({
  table,
  resultFor,
}: {
  table: string
  resultFor: (query: {
    table: string
    operation: string | null
    payload: unknown
    filters: Array<{ column: string; value: unknown }>
  }) => { data: unknown; error: { message: string; code?: string } | null }
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
    insert: vi.fn((payload: unknown) => {
      state.operation = 'insert'
      state.payload = payload
      return query
    }),
    update: vi.fn((payload: unknown) => {
      state.operation = 'update'
      state.payload = payload
      return query
    }),
    eq: vi.fn((column: string, value: unknown) => {
      state.filters.push({ column, value })
      return query
    }),
    in: vi.fn((column: string, value: unknown) => {
      state.filters.push({ column, value })
      return query
    }),
    limit: vi.fn(() => query),
    single: vi.fn(async () => resultFor(state)),
    then: (
      resolve: (
        value: { data: unknown; error: { message: string; code?: string } | null }
      ) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(resultFor(state)).then(resolve, reject),
  }

  return query
}

const baseConnection = {
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
  last_synced_at: '2026-06-01T00:00:00.000Z',
  last_error: null,
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
}

const baseCalendar = {
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

function watchFor(provider: 'google' | 'microsoft', secret: string) {
  return {
    id: 'watch-1',
    connection_id: 'connection-1',
    provider,
    external_calendar_id: 'primary',
    channel_id: provider === 'google' ? 'channel-1' : 'subscription-1',
    resource_id: provider === 'google' ? 'resource-1' : 'me/calendars/primary/events',
    sync_cursor: null,
    expiration_at: '2099-01-01T00:00:00.000Z',
    status: 'active',
    last_sync_at: null,
    last_error: null,
    metadata:
      provider === 'google'
        ? { tokenHash: hash(secret) }
        : { clientStateHash: hash(secret) },
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  }
}

describe('calendar provider watches', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://openslot.example'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  })

  it('creates Google Calendar watches with only a hashed callback token stored', async () => {
    let insertedWatch: any = null
    const adminClient = clientForEnsure({
      connection: baseConnection,
      calendar: baseCalendar,
      existingWatch: null,
      captureInsert: (payload) => {
        insertedWatch = payload
      },
    })
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string)
      return new Response(
        JSON.stringify({
          id: body.id,
          resourceId: 'resource-1',
          expiration: '4070908800000',
        }),
        { status: 200 }
      )
    })

    const result = await ensureCalendarWatchesForConnection(
      adminClient as any,
      'connection-1',
      fetchImpl as typeof fetch
    )
    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string)

    expect(result).toEqual({ checked: 1, ensured: 1, skipped: 0, failed: 0 })
    expect(fetchImpl.mock.calls[0][0]?.toString()).toContain('/events/watch')
    expect(insertedWatch.metadata.tokenHash).toBe(hash(requestBody.token))
    expect(JSON.stringify(insertedWatch)).not.toContain(requestBody.token)
  })

  it('creates Microsoft Graph subscriptions with only a hashed clientState stored', async () => {
    let insertedWatch: any = null
    const connection = { ...baseConnection, provider: 'microsoft' }
    const adminClient = clientForEnsure({
      connection,
      calendar: baseCalendar,
      existingWatch: null,
      captureInsert: (payload) => {
        insertedWatch = payload
      },
    })
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string)
      return new Response(
        JSON.stringify({
          id: 'subscription-1',
          resource: body.resource,
          expirationDateTime: body.expirationDateTime,
        }),
        { status: 200 }
      )
    })

    const result = await ensureCalendarWatchesForConnection(
      adminClient as any,
      'connection-1',
      fetchImpl as typeof fetch
    )
    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string)

    expect(result).toEqual({ checked: 1, ensured: 1, skipped: 0, failed: 0 })
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://graph.microsoft.com/v1.0/subscriptions'
    )
    expect(insertedWatch.metadata.clientStateHash).toBe(
      hash(requestBody.clientState)
    )
    expect(JSON.stringify(insertedWatch)).not.toContain(requestBody.clientState)
  })

  it('rejects Google callbacks with a mismatched channel token', async () => {
    const adminClient = clientForWatch(watchFor('google', 'expected-token'))

    const result = await handleGoogleCalendarWebhook(
      adminClient as any,
      new Headers({
        'x-goog-channel-id': 'channel-1',
        'x-goog-resource-id': 'resource-1',
        'x-goog-resource-state': 'exists',
        'x-goog-channel-token': 'wrong-token',
      })
    )

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: 'Invalid Google calendar token',
    })
    expect(refreshProviderCalendarBusyCache).not.toHaveBeenCalled()
  })

  it('acknowledges Google sync pings without refreshing busy cache', async () => {
    const adminClient = clientForWatch(watchFor('google', 'expected-token'))

    const result = await handleGoogleCalendarWebhook(
      adminClient as any,
      new Headers({
        'x-goog-channel-id': 'channel-1',
        'x-goog-resource-id': 'resource-1',
        'x-goog-resource-state': 'sync',
        'x-goog-channel-token': 'expected-token',
      })
    )

    expect(result).toEqual({ ok: true, status: 204, ignored: true })
    expect(refreshProviderCalendarBusyCache).not.toHaveBeenCalled()
  })

  it('refreshes busy cache for valid Google callbacks', async () => {
    const adminClient = clientForWatch(watchFor('google', 'expected-token'))

    const result = await handleGoogleCalendarWebhook(
      adminClient as any,
      new Headers({
        'x-goog-channel-id': 'channel-1',
        'x-goog-resource-id': 'resource-1',
        'x-goog-resource-state': 'exists',
        'x-goog-channel-token': 'expected-token',
      })
    )

    expect(result).toEqual({ ok: true, status: 204 })
    expect(refreshProviderCalendarBusyCache).toHaveBeenCalledTimes(1)
  })

  it('groups Microsoft notifications by subscription before refreshing', async () => {
    const adminClient = clientForWatch(watchFor('microsoft', 'client-state'))

    const result = await handleMicrosoftCalendarWebhook(adminClient as any, {
      value: [
        { subscriptionId: 'subscription-1', clientState: 'client-state' },
        { subscriptionId: 'subscription-1', clientState: 'client-state' },
      ],
    })

    expect(result).toEqual({ ok: true, status: 202 })
    expect(refreshProviderCalendarBusyCache).toHaveBeenCalledTimes(1)
  })
})

function clientForEnsure({
  connection,
  calendar,
  existingWatch,
  captureInsert,
}: {
  connection: Record<string, unknown>
  calendar: Record<string, unknown>
  existingWatch: Record<string, unknown> | null
  captureInsert: (payload: unknown) => void
}) {
  return {
    from: vi.fn((table: string) =>
      createQuery({
        table,
        resultFor: (query) => {
          if (query.table === 'provider_connections') {
            return { data: connection, error: null }
          }

          if (query.table === 'provider_calendars') {
            return { data: [calendar], error: null }
          }

          if (query.table === 'provider_watches') {
            if (query.operation === 'select') {
              return existingWatch
                ? { data: existingWatch, error: null }
                : {
                    data: null,
                    error: { message: 'No rows found', code: 'PGRST116' },
                  }
            }

            if (query.operation === 'insert') {
              captureInsert(query.payload)
            }
          }

          return { data: null, error: null }
        },
      })
    ),
  }
}

function clientForWatch(watch: Record<string, unknown>) {
  return {
    from: vi.fn((table: string) =>
      createQuery({
        table,
        resultFor: (query) => {
          if (query.table === 'provider_watches') {
            return { data: query.operation === 'select' ? watch : null, error: null }
          }

          return { data: null, error: null }
        },
      })
    ),
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
