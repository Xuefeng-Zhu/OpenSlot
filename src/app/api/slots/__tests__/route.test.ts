import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: {
    from: vi.fn(),
  },
  refreshCalendarAvailabilityForHost: vi.fn(async () => ({
    checked: 0,
    refreshed: 0,
    failed: 0,
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/calendar/provider-sync', () => ({
  refreshCalendarAvailabilityForHost:
    mocks.refreshCalendarAvailabilityForHost,
}))

function createQuery(result: {
  data: unknown
  error: { code?: string; message: string } | null
}) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    gt: vi.fn(() => query),
    gte: vi.fn(() => query),
    in: vi.fn(() => query),
    lte: vi.fn(() => query),
    single: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve),
  }

  return query
}

function slotsRequest() {
  const params = new URLSearchParams({
    hostUserId: '22222222-2222-4222-8222-222222222222',
    eventTypeId: '11111111-1111-4111-8111-111111111111',
    date: '2026-06-15',
    timezone: 'America/New_York',
  })

  return new Request(`http://localhost/api/slots?${params.toString()}`)
}

describe('GET /api/slots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the service-role client and scopes the event type to the host', async () => {
    const eventTypeQuery = createQuery({
      data: {
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_minutes: 0,
        max_booking_days_ahead: 365,
        user_id: '22222222-2222-4222-8222-222222222222',
        is_active: true,
      },
      error: null,
    })
    const rulesQuery = createQuery({
      data: [
        {
          id: 'rule-1',
          user_id: '22222222-2222-4222-8222-222222222222',
          weekday: 1,
          start_time: '09:00',
          end_time: '10:00',
          timezone: 'America/New_York',
          is_active: true,
        },
      ],
      error: null,
    })
    const emptyQuery = createQuery({ data: [], error: null })

    mocks.adminClient.from
      .mockReturnValueOnce(eventTypeQuery)
      .mockReturnValueOnce(rulesQuery)
      .mockReturnValueOnce(emptyQuery)
      .mockReturnValueOnce(emptyQuery)
      .mockReturnValueOnce(emptyQuery)
      .mockReturnValueOnce(emptyQuery)

    const response = await GET(slotsRequest() as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.slots.length).toBeGreaterThan(0)
    expect(eventTypeQuery.eq).toHaveBeenCalledWith(
      'user_id',
      '22222222-2222-4222-8222-222222222222'
    )
    expect(eventTypeQuery.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('excludes slots that overlap synced external calendar busy cache rows', async () => {
    const eventTypeQuery = createQuery({
      data: {
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_minutes: 0,
        max_booking_days_ahead: 365,
        user_id: '22222222-2222-4222-8222-222222222222',
        is_active: true,
      },
      error: null,
    })
    const rulesQuery = createQuery({
      data: [
        {
          id: 'rule-1',
          user_id: '22222222-2222-4222-8222-222222222222',
          weekday: 1,
          start_time: '09:00',
          end_time: '10:00',
          timezone: 'America/New_York',
          is_active: true,
        },
      ],
      error: null,
    })
    const overridesQuery = createQuery({ data: [], error: null })
    const bookingsQuery = createQuery({ data: [], error: null })
    const holdsQuery = createQuery({ data: [], error: null })
    const connectionsQuery = createQuery({
      data: [{ id: 'connection-1' }],
      error: null,
    })
    const calendarsQuery = createQuery({
      data: [{ id: 'calendar-1' }],
      error: null,
    })
    const busyQuery = createQuery({
      data: [
        {
          start_at: '2026-06-15T13:00:00.000Z',
          end_at: '2026-06-15T13:30:00.000Z',
        },
      ],
      error: null,
    })

    mocks.adminClient.from
      .mockReturnValueOnce(eventTypeQuery)
      .mockReturnValueOnce(rulesQuery)
      .mockReturnValueOnce(overridesQuery)
      .mockReturnValueOnce(bookingsQuery)
      .mockReturnValueOnce(holdsQuery)
      .mockReturnValueOnce(connectionsQuery)
      .mockReturnValueOnce(calendarsQuery)
      .mockReturnValueOnce(busyQuery)

    const response = await GET(slotsRequest() as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.slots).toEqual([
      {
        start: '2026-06-15T13:30:00.000Z',
        end: '2026-06-15T14:00:00.000Z',
      },
    ])
    expect(connectionsQuery.eq).toHaveBeenCalledWith(
      'profile_id',
      '22222222-2222-4222-8222-222222222222'
    )
    expect(connectionsQuery.in).toHaveBeenCalledWith('status', [
      'active',
      'error',
    ])
    expect(calendarsQuery.in).toHaveBeenCalledWith('connection_id', [
      'connection-1',
    ])
    expect(calendarsQuery.eq).toHaveBeenCalledWith('use_for_availability', true)
    expect(busyQuery.in).toHaveBeenCalledWith('provider_calendar_id', [
      'calendar-1',
    ])
  })

  it('does not compute slots for an inactive or mismatched event type', async () => {
    const eventTypeQuery = createQuery({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    })
    mocks.adminClient.from.mockReturnValueOnce(eventTypeQuery)

    const response = await GET(slotsRequest() as any)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Event type not found')
    expect(mocks.adminClient.from).toHaveBeenCalledTimes(1)
  })
})
