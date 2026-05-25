import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: {
    from: vi.fn(),
  },
  consumePublicRateLimit: vi.fn(),
  refreshCalendarAvailabilityForHost: vi.fn(async () => ({
    checked: 0,
    refreshed: 0,
    failed: 0,
  })),
}))

vi.mock('@/lib/backend/server', () => ({
  createAdminBackendClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/calendar/provider-sync', () => ({
  refreshCalendarAvailabilityForHost:
    mocks.refreshCalendarAvailabilityForHost,
}))

vi.mock('@/lib/security/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security/rate-limit')>(
    '@/lib/security/rate-limit'
  )

  return {
    ...actual,
    consumePublicRateLimit: mocks.consumePublicRateLimit,
  }
})

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

function slotRangeRequest(overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({
    hostUserId: '22222222-2222-4222-8222-222222222222',
    eventTypeId: '11111111-1111-4111-8111-111111111111',
    startDate: '2026-06-15',
    endDate: '2026-06-16',
    timezone: 'America/New_York',
    ...overrides,
  })

  return new Request(`http://localhost/api/slots?${params.toString()}`)
}

describe('GET /api/slots', () => {
  beforeEach(() => {
    mocks.adminClient.from.mockReset()
    mocks.consumePublicRateLimit.mockReset()
    mocks.refreshCalendarAvailabilityForHost.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: true,
      limit: 120,
      remaining: 119,
      resetAt: '2026-06-01T00:01:00.000Z',
    })
    mocks.refreshCalendarAvailabilityForHost.mockResolvedValue({
      checked: 0,
      refreshed: 0,
      failed: 0,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the service-key client and scopes the event type to the host', async () => {
    const eventTypeQuery = createQuery({
      data: {
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_minutes: 0,
        max_booking_days_ahead: 365,
        schedule_id: 'schedule-1',
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
          schedule_id: 'schedule-1',
          weekday: 1,
          start_time: '09:00',
          end_time: '10:00',
          timezone: 'America/New_York',
          is_active: true,
        },
      ],
      error: null,
    })
    const scheduleQuery = createQuery({
      data: {
        id: 'schedule-1',
        timezone: 'America/New_York',
      },
      error: null,
    })
    const emptyQuery = createQuery({ data: [], error: null })

    mocks.adminClient.from
      .mockReturnValueOnce(eventTypeQuery)
      .mockReturnValueOnce(scheduleQuery)
      .mockReturnValueOnce(rulesQuery)
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
    expect(mocks.consumePublicRateLimit).toHaveBeenCalledWith({
      request: expect.any(Request),
      adminClient: mocks.adminClient,
      config: {
        scope: 'list-slots',
        limit: 120,
        windowSeconds: 60,
      },
    })
  })

  it('rate limits slot lookups before computing availability', async () => {
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: false,
      status: 429,
      error: 'Too many requests. Please retry after the rate limit resets.',
      limit: 120,
      remaining: 0,
      resetAt: '2026-06-01T00:01:00.000Z',
      retryAfterSeconds: 30,
    })

    const response = await GET(slotsRequest() as any)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('30')
    expect(data.rateLimit.remaining).toBe(0)
    expect(mocks.adminClient.from).not.toHaveBeenCalled()
  })

  it('returns slots for an inclusive date range with hold tokens', async () => {
    const eventTypeQuery = createQuery({
      data: {
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_minutes: 0,
        max_booking_days_ahead: 365,
        schedule_id: 'schedule-1',
        user_id: '22222222-2222-4222-8222-222222222222',
        is_active: true,
      },
      error: null,
    })
    const scheduleQuery = createQuery({
      data: {
        id: 'schedule-1',
        timezone: 'America/New_York',
      },
      error: null,
    })
    const rulesQuery = createQuery({
      data: [
        {
          id: 'rule-1',
          user_id: '22222222-2222-4222-8222-222222222222',
          schedule_id: 'schedule-1',
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

    mocks.adminClient.from
      .mockReturnValueOnce(eventTypeQuery)
      .mockReturnValueOnce(scheduleQuery)
      .mockReturnValueOnce(rulesQuery)
      .mockReturnValueOnce(overridesQuery)
      .mockReturnValueOnce(bookingsQuery)
      .mockReturnValueOnce(holdsQuery)

    const response = await GET(slotRangeRequest() as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.slotsByDate).toEqual({
      '2026-06-15': [
        {
          start: '2026-06-15T13:00:00.000Z',
          end: '2026-06-15T13:30:00.000Z',
          slotToken: expect.any(String),
        },
        {
          start: '2026-06-15T13:30:00.000Z',
          end: '2026-06-15T14:00:00.000Z',
          slotToken: expect.any(String),
        },
      ],
      '2026-06-16': [],
    })
    expect(overridesQuery.in).toHaveBeenCalledWith('date', [
      '2026-06-15',
      '2026-06-16',
    ])
    expect(mocks.adminClient.from).toHaveBeenCalledTimes(6)
  })

  it('accepts timezone aliases and case variants supported by Intl', async () => {
    const eventTypeQuery = createQuery({
      data: {
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_minutes: 0,
        max_booking_days_ahead: 365,
        schedule_id: 'schedule-1',
        user_id: '22222222-2222-4222-8222-222222222222',
        is_active: true,
      },
      error: null,
    })
    const scheduleQuery = createQuery({
      data: {
        id: 'schedule-1',
        timezone: 'America/New_York',
      },
      error: null,
    })
    const rulesQuery = createQuery({
      data: [
        {
          id: 'rule-1',
          user_id: '22222222-2222-4222-8222-222222222222',
          schedule_id: 'schedule-1',
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
      .mockReturnValueOnce(scheduleQuery)
      .mockReturnValueOnce(rulesQuery)
      .mockReturnValueOnce(emptyQuery)
      .mockReturnValueOnce(emptyQuery)
      .mockReturnValueOnce(emptyQuery)

    const response = await GET(
      slotRangeRequest({ timezone: 'america/new_york' }) as any
    )

    expect(response.status).toBe(200)
    expect(mocks.consumePublicRateLimit).toHaveBeenCalled()
    expect(mocks.adminClient.from).toHaveBeenCalledTimes(6)
  })

  it('rejects unbounded slot range lookups before rate limiting', async () => {
    const response = await GET(
      slotRangeRequest({ endDate: '2026-08-31' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Date range cannot exceed 60 days.')
    expect(mocks.consumePublicRateLimit).not.toHaveBeenCalled()
    expect(mocks.adminClient.from).not.toHaveBeenCalled()
  })

  it('rejects impossible slot range calendar dates before rate limiting', async () => {
    const response = await GET(
      slotRangeRequest({ startDate: '2026-02-31' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe(
      'Invalid date range. Expected real YYYY-MM-DD calendar dates.'
    )
    expect(mocks.consumePublicRateLimit).not.toHaveBeenCalled()
    expect(mocks.adminClient.from).not.toHaveBeenCalled()
  })

  it('rejects invalid timezones before rate limiting', async () => {
    const response = await GET(
      slotRangeRequest({ timezone: 'Not/A_Timezone' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe(
      'Invalid timezone. Expected a valid IANA timezone.'
    )
    expect(mocks.consumePublicRateLimit).not.toHaveBeenCalled()
    expect(mocks.adminClient.from).not.toHaveBeenCalled()
  })

  it('excludes slots that overlap synced external calendar busy cache rows', async () => {
    mocks.refreshCalendarAvailabilityForHost.mockResolvedValueOnce({
      checked: 1,
      refreshed: 0,
      failed: 0,
    })

    const eventTypeQuery = createQuery({
      data: {
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_minutes: 0,
        max_booking_days_ahead: 365,
        schedule_id: 'schedule-1',
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
          schedule_id: 'schedule-1',
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
    const scheduleQuery = createQuery({
      data: {
        id: 'schedule-1',
        timezone: 'America/New_York',
      },
      error: null,
    })
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
      .mockReturnValueOnce(scheduleQuery)
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
        slotToken: expect.any(String),
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
