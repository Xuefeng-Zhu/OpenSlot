import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadAvailableSlotsForDate,
  validateHoldSlotRequest,
} from '../available-slots'

const mocks = vi.hoisted(() => ({
  refreshCalendarAvailabilityForHost: vi.fn(async () => ({
    checked: 0,
    refreshed: 0,
    failed: 0,
  })),
}))

vi.mock('@/lib/calendar/provider-sync', () => ({
  refreshCalendarAvailabilityForHost:
    mocks.refreshCalendarAvailabilityForHost,
}))

const hostUserId = '22222222-2222-4222-8222-222222222222'
const eventTypeId = '11111111-1111-4111-8111-111111111111'

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

function availabilityQuerySet({
  rules = [
    {
      id: 'rule-1',
      user_id: hostUserId,
      schedule_id: 'schedule-1',
      weekday: 1,
      start_time: '09:00',
      end_time: '10:00',
      timezone: 'America/New_York',
      is_active: true,
    },
  ],
  overrides = [],
  bookings = [],
  holds = [],
  connections = [],
}: {
  rules?: unknown[]
  overrides?: unknown[]
  bookings?: unknown[]
  holds?: unknown[]
  connections?: unknown[]
} = {}) {
  return [
    createQuery({
      data: { id: 'schedule-1', timezone: 'America/New_York' },
      error: null,
    }),
    createQuery({ data: rules, error: null }),
    createQuery({ data: overrides, error: null }),
    createQuery({ data: bookings, error: null }),
    createQuery({ data: holds, error: null }),
    createQuery({ data: connections, error: null }),
  ]
}

function createSupabaseClient(queries: any[]) {
  return {
    from: vi.fn(() => {
      const query = queries.shift()
      if (!query) {
        throw new Error('Unexpected Supabase query')
      }

      return query
    }),
  }
}

function eventTypeQuery(overrides: Record<string, unknown> = {}) {
  return createQuery({
    data: {
      duration_minutes: 30,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_minutes: 0,
      max_booking_days_ahead: 365,
      schedule_id: 'schedule-1',
      user_id: hostUserId,
      is_active: true,
      ...overrides,
    },
    error: null,
  })
}

describe('validateHoldSlotRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts an exact slot from computed public availability', async () => {
    const eventQuery = eventTypeQuery()
    const supabase = createSupabaseClient([
      eventQuery,
      ...availabilityQuerySet(),
    ])

    const result = await validateHoldSlotRequest({
      supabase: supabase as any,
      hostUserId,
      eventTypeId,
      startAt: '2025-01-06T14:00:00.000Z',
      endAt: '2025-01-06T14:30:00.000Z',
    })

    expect(result).toEqual({ success: true })
    expect(mocks.refreshCalendarAvailabilityForHost).toHaveBeenCalledWith(
      supabase,
      hostUserId,
      '2025-01-04T00:00:00.000Z',
      '2025-01-08T23:59:59.999Z'
    )
    expect(eventQuery.eq).toHaveBeenCalledWith('id', eventTypeId)
    expect(eventQuery.eq).toHaveBeenCalledWith('user_id', hostUserId)
    expect(eventQuery.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('rejects a hold duration that does not match the event type', async () => {
    const supabase = createSupabaseClient([eventTypeQuery()])

    const result = await validateHoldSlotRequest({
      supabase: supabase as any,
      hostUserId,
      eventTypeId,
      startAt: '2025-01-06T14:00:00.000Z',
      endAt: '2025-01-06T14:45:00.000Z',
    })

    expect(result).toEqual({
      success: false,
      status: 400,
      error: 'Requested hold duration must match the event type duration.',
    })
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it('rejects a same-duration hold outside availability windows', async () => {
    const supabase = createSupabaseClient([
      eventTypeQuery(),
      ...availabilityQuerySet(),
      ...availabilityQuerySet(),
      ...availabilityQuerySet(),
    ])

    const result = await validateHoldSlotRequest({
      supabase: supabase as any,
      hostUserId,
      eventTypeId,
      startAt: '2025-01-06T17:00:00.000Z',
      endAt: '2025-01-06T17:30:00.000Z',
    })

    expect(result).toEqual({
      success: false,
      status: 409,
      error: 'This time slot is no longer available. Please select a different time.',
    })
  })

  it('rejects inactive or mismatched event types', async () => {
    const supabase = createSupabaseClient([
      createQuery({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      }),
    ])

    const result = await validateHoldSlotRequest({
      supabase: supabase as any,
      hostUserId,
      eventTypeId,
      startAt: '2025-01-06T14:00:00.000Z',
      endAt: '2025-01-06T14:30:00.000Z',
    })

    expect(result).toEqual({
      success: false,
      status: 404,
      error: 'Event type not found',
    })
  })

  it('returns a server error when event type lookup fails unexpectedly', async () => {
    const supabase = createSupabaseClient([
      createQuery({
        data: null,
        error: { code: 'PGRST301', message: 'connection unavailable' },
      }),
    ])

    const result = await validateHoldSlotRequest({
      supabase: supabase as any,
      hostUserId,
      eventTypeId,
      startAt: '2025-01-06T14:00:00.000Z',
      endAt: '2025-01-06T14:30:00.000Z',
    })

    expect(result).toEqual({
      success: false,
      status: 500,
      error: 'Failed to fetch event type',
    })
  })
})

describe('loadAvailableSlotsForDate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes external calendar availability before reading cached busy slots', async () => {
    const eventQuery = eventTypeQuery()
    const supabase = createSupabaseClient([
      eventQuery,
      ...availabilityQuerySet(),
    ])

    const result = await loadAvailableSlotsForDate({
      supabase: supabase as any,
      hostUserId,
      eventTypeId,
      date: '2025-01-06',
      guestTimezone: 'America/New_York',
    })

    expect(result.success).toBe(true)
    expect(mocks.refreshCalendarAvailabilityForHost).toHaveBeenCalledWith(
      supabase,
      hostUserId,
      '2025-01-05T00:00:00.000Z',
      '2025-01-07T23:59:59.999Z'
    )
  })

  it('uses the event type schedule to choose availability rules', async () => {
    const firstScheduleClient = createSupabaseClient([
      eventTypeQuery({ schedule_id: 'schedule-1' }),
      createQuery({
        data: { id: 'schedule-1', timezone: 'America/New_York' },
        error: null,
      }),
      ...availabilityQuerySet({
        rules: [
          {
            id: 'rule-1',
            user_id: hostUserId,
            schedule_id: 'schedule-1',
            weekday: 1,
            start_time: '09:00',
            end_time: '09:30',
            timezone: 'America/New_York',
            is_active: true,
          },
        ],
      }).slice(1),
    ])
    const secondScheduleClient = createSupabaseClient([
      eventTypeQuery({ schedule_id: 'schedule-2' }),
      createQuery({
        data: { id: 'schedule-2', timezone: 'America/New_York' },
        error: null,
      }),
      ...availabilityQuerySet({
        rules: [
          {
            id: 'rule-2',
            user_id: hostUserId,
            schedule_id: 'schedule-2',
            weekday: 1,
            start_time: '11:00',
            end_time: '11:30',
            timezone: 'America/New_York',
            is_active: true,
          },
        ],
      }).slice(1),
    ])

    const firstResult = await loadAvailableSlotsForDate({
      supabase: firstScheduleClient as any,
      hostUserId,
      eventTypeId,
      date: '2025-01-06',
      guestTimezone: 'America/New_York',
    })
    const secondResult = await loadAvailableSlotsForDate({
      supabase: secondScheduleClient as any,
      hostUserId,
      eventTypeId: '22222222-2222-4222-8222-222222222222',
      date: '2025-01-06',
      guestTimezone: 'America/New_York',
    })

    expect(firstResult).toEqual({
      success: true,
      slots: [
        {
          start: '2025-01-06T14:00:00.000Z',
          end: '2025-01-06T14:30:00.000Z',
        },
      ],
    })
    expect(secondResult).toEqual({
      success: true,
      slots: [
        {
          start: '2025-01-06T16:00:00.000Z',
          end: '2025-01-06T16:30:00.000Z',
        },
      ],
    })
  })
})
