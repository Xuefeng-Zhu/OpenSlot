import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'
import { DELETE, PATCH } from '../[id]/route'
import { POST as DUPLICATE_POST } from '../[id]/duplicate/route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { id: 'profile-1', default_timezone: 'America/New_York' } as
    | { id: string; default_timezone: string }
    | null,
  adminQueries: [] as any[],
  adminTables: [] as string[],
  inserts: [] as Array<{ table: string; payload: unknown }>,
  scheduleInsertPayload: null as Record<string, unknown> | null,
  scheduleUpdates: [] as Record<string, unknown>[],
  scheduleDeletes: 0,
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rpcResults: [] as Array<{ data: unknown; error: unknown }>,
}))

function createQuery(result: Record<string, unknown>) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    insert: vi.fn((payload: Record<string, unknown>) => {
      const table = query.__table ?? 'unknown'
      mocks.inserts.push({ table, payload })
      if (table === 'schedules') {
        mocks.scheduleInsertPayload = payload
      }
      return query
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      mocks.scheduleUpdates.push(payload)
      return query
    }),
    delete: vi.fn(() => {
      mocks.scheduleDeletes += 1
      return query
    }),
    single: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve),
  }

  return query
}

function createProfileQuery() {
  const result = { data: mocks.profile, error: null }
  const query: any = {
    select: () => query,
    eq: () => query,
    single: async () => result,
  }

  return query
}

vi.mock('@/lib/backend/server', () => ({
  createServerBackendClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: (table: string) => {
      if (table !== 'profiles') throw new Error(`Unexpected server table: ${table}`)
      return createProfileQuery()
    },
  })),
  createAdminBackendClient: vi.fn(() => ({
    from: (table: string) => {
      const query = mocks.adminQueries.shift()
      if (!query) throw new Error('Unexpected admin query')
      query.__table = table
      mocks.adminTables.push(table)
      return query
    },
    rpc: (name: string, args: Record<string, unknown>) => {
      mocks.rpcCalls.push({ name, args })
      const result = mocks.rpcResults.shift()
      if (!result) throw new Error('Unexpected admin RPC')

      return {
        single: async () => result,
      }
    },
  })),
}))

function requestWithJson(body: unknown) {
  return {
    json: async () => body,
  } as Request
}

function requestWithInvalidJson() {
  return {
    json: async () => {
      throw new SyntaxError('Unexpected token')
    },
  } as unknown as Request
}

function routeContext(id = 'schedule-1') {
  return {
    params: Promise.resolve({ id }),
  }
}

describe('availability schedule routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.profile = { id: 'profile-1', default_timezone: 'America/New_York' }
    mocks.adminQueries = []
    mocks.adminTables = []
    mocks.inserts = []
    mocks.scheduleInsertPayload = null
    mocks.scheduleUpdates = []
    mocks.scheduleDeletes = 0
    mocks.rpcCalls = []
    mocks.rpcResults = []
  })

  it('creates a non-default schedule for the authenticated profile', async () => {
    mocks.adminQueries = [
      createQuery({
        data: {
          id: 'schedule-2',
          name: 'Sales calls',
          timezone: 'America/New_York',
          is_default: false,
        },
        error: null,
      }),
    ]

    const response = await POST(
      requestWithJson({ name: 'Sales calls' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(mocks.scheduleInsertPayload).toMatchObject({
      user_id: 'profile-1',
      name: 'Sales calls',
      timezone: 'America/New_York',
      is_default: false,
    })
  })

  it('rejects malformed JSON when creating a schedule', async () => {
    const response = await POST(requestWithInvalidJson() as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ success: false, error: 'Invalid JSON body' })
    expect(mocks.adminTables).toHaveLength(0)
  })

  it('promotes one owned schedule to default', async () => {
    mocks.adminQueries = [
      createQuery({
        data: { id: 'schedule-2', is_default: false },
        error: null,
      }),
    ]
    mocks.rpcResults = [
      {
        data: {
          id: 'schedule-2',
          name: 'Sales calls',
          timezone: 'America/New_York',
          is_default: true,
        },
        error: null,
      },
    ]

    const response = await PATCH(
      requestWithJson({ isDefault: true }) as any,
      routeContext('schedule-2') as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.schedule.is_default).toBe(true)
    expect(mocks.scheduleUpdates).toHaveLength(0)
    expect(mocks.rpcCalls).toEqual([
      {
        name: 'set_default_schedule',
        args: {
          p_user_id: 'profile-1',
          p_schedule_id: 'schedule-2',
          p_name: null,
          p_update_name: false,
        },
      },
    ])
  })

  it('rejects malformed JSON when updating a schedule', async () => {
    const response = await PATCH(
      requestWithInvalidJson() as any,
      routeContext('schedule-2') as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ success: false, error: 'Invalid JSON body' })
    expect(mocks.adminTables).toHaveLength(0)
  })

  it('blocks deleting schedules assigned to event types', async () => {
    mocks.adminQueries = [
      createQuery({
        data: { id: 'schedule-2', is_default: false },
        error: null,
      }),
      createQuery({ data: null, count: 1, error: null }),
    ]

    const response = await DELETE({} as any, routeContext('schedule-2') as any)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('assigned to event types')
    expect(mocks.scheduleDeletes).toBe(0)
  })

  it('duplicates an owned schedule with rules and overrides', async () => {
    mocks.adminQueries = [
      createQuery({
        data: { id: 'schedule-1', timezone: 'America/New_York' },
        error: null,
      }),
      createQuery({
        data: [
          {
            weekday: 1,
            start_time: '09:00:00',
            end_time: '17:00:00',
            timezone: 'America/New_York',
            is_active: true,
          },
        ],
        error: null,
      }),
      createQuery({
        data: [
          {
            date: '2026-06-01',
            start_time: '13:00:00',
            end_time: '15:00:00',
            timezone: 'America/New_York',
            is_available: true,
            reason: 'Conference',
          },
        ],
        error: null,
      }),
      createQuery({
        data: {
          id: 'schedule-2',
          name: 'Copy of Working hours',
          timezone: 'America/New_York',
          is_default: false,
        },
        error: null,
      }),
      createQuery({ data: null, error: null }),
      createQuery({ data: null, error: null }),
    ]

    const response = await DUPLICATE_POST(
      requestWithJson({ name: 'Copy of Working hours' }) as any,
      routeContext('schedule-1') as any
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.schedule).toMatchObject({
      id: 'schedule-2',
      name: 'Copy of Working hours',
      is_default: false,
    })
    expect(mocks.inserts.find((insert) => insert.table === 'schedules')).toMatchObject({
      payload: {
        user_id: 'profile-1',
        name: 'Copy of Working hours',
        timezone: 'America/New_York',
        is_default: false,
      },
    })
    expect(
      mocks.inserts.find((insert) => insert.table === 'availability_rules')
    ).toMatchObject({
      payload: [
        {
          user_id: 'profile-1',
          schedule_id: 'schedule-2',
          weekday: 1,
          start_time: '09:00:00',
          end_time: '17:00:00',
          timezone: 'America/New_York',
          is_active: true,
        },
      ],
    })
    expect(
      mocks.inserts.find((insert) => insert.table === 'availability_overrides')
    ).toMatchObject({
      payload: [
        {
          user_id: 'profile-1',
          schedule_id: 'schedule-2',
          date: '2026-06-01',
          start_time: '13:00:00',
          end_time: '15:00:00',
          timezone: 'America/New_York',
          is_available: true,
          reason: 'Conference',
        },
      ],
    })
  })

  it('rejects invalid duplicate schedule names', async () => {
    const response = await DUPLICATE_POST(
      requestWithJson({ name: '' }) as any,
      routeContext('schedule-1') as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(mocks.inserts).toHaveLength(0)
  })

  it('rejects malformed JSON when duplicating a schedule', async () => {
    const response = await DUPLICATE_POST(
      requestWithInvalidJson() as any,
      routeContext('schedule-1') as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ success: false, error: 'Invalid JSON body' })
    expect(mocks.adminTables).toHaveLength(0)
  })

  it('rejects duplicate requests for foreign schedules', async () => {
    mocks.adminQueries = [
      createQuery({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      }),
    ]

    const response = await DUPLICATE_POST(
      requestWithJson({ name: 'Copy of Team hours' }) as any,
      routeContext('foreign-schedule') as any
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Schedule not found')
    expect(mocks.inserts).toHaveLength(0)
  })
})
