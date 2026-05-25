import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  currentBackendAccessToken: vi.fn(),
  createBackendCompatClient: vi.fn(),
}))

vi.mock('@/lib/backend/server', () => ({
  currentBackendAccessToken: mocks.currentBackendAccessToken,
}))

vi.mock('@/lib/backend/compat/query-client', () => ({
  createBackendCompatClient: mocks.createBackendCompatClient,
}))

function requestWithJson(body: unknown) {
  return new Request('http://localhost/api/backend/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createQuery(
  result: { data: unknown; error: unknown | null } = {
    data: [],
    error: null,
  }
) {
  const query: any = {
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    upsert: vi.fn(() => query),
    eq: vi.fn(() => query),
    gt: vi.fn(() => query),
    gte: vi.fn(() => query),
    lt: vi.fn(() => query),
    lte: vi.fn(() => query),
    is: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    offset: vi.fn(() => query),
    single: vi.fn(() => query),
    maybeSingle: vi.fn(() => query),
    then: vi.fn((resolve: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve)
    ),
  }

  return query
}

describe('POST /api/backend/query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentBackendAccessToken.mockResolvedValue('access-token')
  })

  it('allows the profile update mutation used by the browser profile form', async () => {
    const query = createQuery({ data: [], error: null })
    const from = vi.fn(() => query)
    mocks.createBackendCompatClient.mockReturnValue({ from })

    const payload = {
      name: 'Ada Lovelace',
      username: 'ada',
      default_timezone: 'America/New_York',
      public_headline: 'Booking page',
      public_bio: null,
      response_time_label: 'Usually replies within a day',
      updated_at: '2026-06-16T16:00:00.000Z',
    }

    const response = await POST(
      requestWithJson({
        table: 'profiles',
        operation: 'update',
        payload,
        filters: [
          { column: 'auth_user_id', operator: 'eq', value: 'auth-user-1' },
        ],
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toEqual([])
    expect(from).toHaveBeenCalledWith('profiles')
    expect(query.update).toHaveBeenCalledWith(payload)
    expect(query.eq).toHaveBeenCalledWith('auth_user_id', 'auth-user-1')
    expect(query.select).not.toHaveBeenCalled()
  })

  it('rejects event type deletion through the generic browser query route', async () => {
    const query = createQuery({ data: [], error: null })
    const from = vi.fn(() => query)
    mocks.createBackendCompatClient.mockReturnValue({ from })

    const response = await POST(
      requestWithJson({
        table: 'event_types',
        operation: 'delete',
        filters: [{ column: 'id', operator: 'eq', value: 'event-type-1' }],
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('Unsupported table')
    expect(mocks.createBackendCompatClient).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
    expect(query.delete).not.toHaveBeenCalled()
  })

  it('rejects table operations outside the browser mutation allowlist', async () => {
    const response = await POST(
      requestWithJson({
        table: 'profiles',
        operation: 'select',
        filters: [
          { column: 'auth_user_id', operator: 'eq', value: 'auth-user-1' },
        ],
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('Unsupported operation')
    expect(mocks.createBackendCompatClient).not.toHaveBeenCalled()
  })

  it.each(['insert', 'upsert'] as const)(
    'rejects broad mutation operation %s even for allowlisted tables',
    async (operation) => {
      const response = await POST(
        requestWithJson({
          table: 'profiles',
          operation,
          payload: { name: 'Ada Lovelace' },
          filters: [
            { column: 'auth_user_id', operator: 'eq', value: 'auth-user-1' },
          ],
        }) as any
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toBe('Unsupported operation')
      expect(mocks.createBackendCompatClient).not.toHaveBeenCalled()
    }
  )

  it('rejects selected mutation response columns before creating a query client', async () => {
    const response = await POST(
      requestWithJson({
        table: 'profiles',
        operation: 'update',
        payload: { name: 'Ada Lovelace' },
        selected: 'id,name',
        filters: [
          { column: 'auth_user_id', operator: 'eq', value: 'auth-user-1' },
        ],
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe(
      'Selecting mutation response columns is not supported'
    )
    expect(mocks.createBackendCompatClient).not.toHaveBeenCalled()
  })

  it('rejects unsupported filters before creating a query client', async () => {
    const response = await POST(
      requestWithJson({
        table: 'profiles',
        operation: 'update',
        payload: { name: 'Ada Lovelace' },
        filters: [{ column: 'id', operator: 'eq', value: 'profile-1' }],
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('Missing required filter: auth_user_id')
    expect(mocks.createBackendCompatClient).not.toHaveBeenCalled()
  })

  it('rejects unexpected update columns', async () => {
    const response = await POST(
      requestWithJson({
        table: 'profiles',
        operation: 'update',
        payload: {
          name: 'Ada Lovelace',
          role: 'admin',
        },
        filters: [
          { column: 'auth_user_id', operator: 'eq', value: 'auth-user-1' },
        ],
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('Unsupported payload column: role')
    expect(mocks.createBackendCompatClient).not.toHaveBeenCalled()
  })

  it('rejects malformed filter containers before creating a query client', async () => {
    const response = await POST(
      requestWithJson({
        table: 'event_types',
        operation: 'select',
        selected: 'id',
        filters: { column: 'id', operator: 'eq', value: 'event-type-1' },
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('Invalid query request')
    expect(mocks.createBackendCompatClient).not.toHaveBeenCalled()
  })

  it('rejects malformed order containers before creating a query client', async () => {
    const response = await POST(
      requestWithJson({
        table: 'event_types',
        operation: 'select',
        selected: 'id',
        orders: { column: 'created_at', ascending: false },
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('Invalid query request')
    expect(mocks.createBackendCompatClient).not.toHaveBeenCalled()
  })

  it('rejects oversized limits before creating a query client', async () => {
    const response = await POST(
      requestWithJson({
        table: 'event_types',
        operation: 'select',
        selected: 'id',
        limitCount: 501,
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('Invalid query request')
    expect(mocks.createBackendCompatClient).not.toHaveBeenCalled()
  })

  it('returns a structured error when query execution rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const query: any = {
      update: vi.fn(() => query),
      eq: vi.fn(() => query),
      then: vi.fn(
        (
          _resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown
        ) => {
          reject?.(new Error('backend unavailable'))
        }
      ),
    }
    mocks.createBackendCompatClient.mockReturnValue({
      from: vi.fn(() => query),
    })

    const response = await POST(
      requestWithJson({
        table: 'profiles',
        operation: 'update',
        payload: { name: 'Ada Lovelace' },
        filters: [
          { column: 'auth_user_id', operator: 'eq', value: 'auth-user-1' },
        ],
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error.message).toBe('Backend query failed')
    consoleError.mockRestore()
  })
})
