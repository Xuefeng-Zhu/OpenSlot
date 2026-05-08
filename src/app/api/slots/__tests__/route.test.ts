import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: {
    from: vi.fn(),
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
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
