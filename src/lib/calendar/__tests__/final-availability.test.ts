import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyFinalProviderAvailability } from '../final-availability'
import {
  getFreshAccessToken,
  listProviderBusyEvents,
} from '../provider-sync'

vi.mock('../provider-sync', () => ({
  getFreshAccessToken: vi.fn(async () => 'access-token'),
  listProviderBusyEvents: vi.fn(async () => []),
}))

function createQuery({
  table,
  resultFor,
}: {
  table: string
  resultFor: (table: string) => { data: unknown; error: { message: string } | null }
}) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    then: (
      resolve: (value: { data: unknown; error: { message: string } | null }) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(resultFor(table)).then(resolve, reject),
  }

  return query
}

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
  last_synced_at: '2026-06-01T00:00:00.000Z',
  last_error: null,
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
}

const calendar = {
  id: 'calendar-1',
  connection_id: 'connection-1',
  external_calendar_id: 'primary',
  timezone: 'America/Los_Angeles',
}

const watch = {
  connection_id: 'connection-1',
  external_calendar_id: 'primary',
  status: 'active',
  expiration_at: '2099-01-01T00:00:00.000Z',
  metadata: { tokenHash: 'hashed-token' },
}

describe('verifyFinalProviderAvailability', () => {
  const originalFinalCheck = process.env.CALENDAR_FINAL_AVAILABILITY_CHECK
  const originalStaleAfter = process.env.CALENDAR_STALE_AFTER_MINUTES

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T14:20:00.000Z'))
    process.env.CALENDAR_FINAL_AVAILABILITY_CHECK = 'stale'
    process.env.CALENDAR_STALE_AFTER_MINUTES = '10'
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env.CALENDAR_FINAL_AVAILABILITY_CHECK = originalFinalCheck
    process.env.CALENDAR_STALE_AFTER_MINUTES = originalStaleAfter
  })

  it('does nothing when the final provider check is disabled', async () => {
    process.env.CALENDAR_FINAL_AVAILABILITY_CHECK = undefined
    const adminClient = { from: vi.fn() }

    const result = await verifyFinalProviderAvailability(adminClient as any, {
      hostUserId: 'profile-1',
      startAt: '2026-06-01T14:00:00.000Z',
      endAt: '2026-06-01T14:30:00.000Z',
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    })

    expect(result).toEqual({ success: true, checked: false, reason: 'disabled' })
    expect(adminClient.from).not.toHaveBeenCalled()
  })

  it('live-checks stale calendar state and allows free slots', async () => {
    const adminClient = clientForHealth({
      connection: { ...connection, last_synced_at: '2026-06-01T13:00:00.000Z' },
    })

    const result = await verifyFinalProviderAvailability(adminClient as any, {
      hostUserId: 'profile-1',
      startAt: '2026-06-01T14:00:00.000Z',
      endAt: '2026-06-01T14:30:00.000Z',
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    })

    expect(result).toEqual({ success: true, checked: true, reason: 'verified' })
    expect(getFreshAccessToken).toHaveBeenCalled()
    expect(listProviderBusyEvents).toHaveBeenCalled()
  })

  it('rejects stale slots that overlap live provider busy events', async () => {
    vi.mocked(listProviderBusyEvents).mockResolvedValueOnce([
      {
        sourceEventId: 'busy-1',
        startAt: '2026-06-01T14:15:00.000Z',
        endAt: '2026-06-01T14:45:00.000Z',
        transparency: 'busy',
        etag: null,
        metadata: {},
      },
    ])
    const adminClient = clientForHealth({
      connection: { ...connection, last_synced_at: '2026-06-01T13:00:00.000Z' },
    })

    const result = await verifyFinalProviderAvailability(adminClient as any, {
      hostUserId: 'profile-1',
      startAt: '2026-06-01T14:00:00.000Z',
      endAt: '2026-06-01T14:30:00.000Z',
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    })

    expect(result).toEqual({
      success: false,
      status: 409,
      error:
        'This slot conflicts with a connected calendar event. Please select a different time.',
    })
  })

  it('fails closed when the live provider check errors', async () => {
    vi.mocked(getFreshAccessToken).mockRejectedValueOnce(
      new Error('provider unavailable')
    )
    const adminClient = clientForHealth({
      connection: { ...connection, last_synced_at: '2026-06-01T13:00:00.000Z' },
    })

    const result = await verifyFinalProviderAvailability(adminClient as any, {
      hostUserId: 'profile-1',
      startAt: '2026-06-01T14:00:00.000Z',
      endAt: '2026-06-01T14:30:00.000Z',
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    })

    expect(result).toEqual({
      success: false,
      status: 503,
      error:
        'Could not verify connected calendar availability. Please try again.',
    })
  })
})

function clientForHealth({
  connection: connectionRow = connection,
  calendarRows = [calendar],
  watchRows = [watch],
}: {
  connection?: Record<string, unknown>
  calendarRows?: Record<string, unknown>[]
  watchRows?: Record<string, unknown>[]
}) {
  return {
    from: vi.fn((table: string) =>
      createQuery({
        table,
        resultFor: (queryTable) => {
          if (queryTable === 'provider_connections') {
            return { data: [connectionRow], error: null }
          }

          if (queryTable === 'provider_calendars') {
            return { data: calendarRows, error: null }
          }

          if (queryTable === 'provider_watches') {
            return { data: watchRows, error: null }
          }

          return { data: [], error: null }
        },
      })
    ),
  }
}
