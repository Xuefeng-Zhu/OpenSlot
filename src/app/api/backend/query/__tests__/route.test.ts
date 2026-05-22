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

  it('applies supported browser query filters', async () => {
    const query = createQuery({ data: [{ id: 'event-type-1' }], error: null })
    mocks.createBackendCompatClient.mockReturnValue({
      from: vi.fn(() => query),
    })

    const response = await POST(
      requestWithJson({
        table: 'event_types',
        operation: 'select',
        selected: 'id',
        filters: [
          { column: 'user_id', operator: 'eq', value: 'host-1' },
          { column: 'id', operator: 'in', value: ['event-type-1'] },
        ],
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toEqual([{ id: 'event-type-1' }])
    expect(query.eq).toHaveBeenCalledWith('user_id', 'host-1')
    expect(query.in).toHaveBeenCalledWith('id', ['event-type-1'])
  })

  it('rejects unsupported filters instead of silently dropping them', async () => {
    const query = createQuery()
    mocks.createBackendCompatClient.mockReturnValue({
      from: vi.fn(() => query),
    })

    const response = await POST(
      requestWithJson({
        table: 'event_types',
        operation: 'select',
        selected: 'id',
        filters: [{ column: 'title', operator: 'ilike', value: '%call%' }],
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('Unsupported filter operator: ilike')
    expect(query.then).not.toHaveBeenCalled()
  })

  it('rejects malformed in filters', async () => {
    const query = createQuery()
    mocks.createBackendCompatClient.mockReturnValue({
      from: vi.fn(() => query),
    })

    const response = await POST(
      requestWithJson({
        table: 'event_types',
        operation: 'select',
        selected: 'id',
        filters: [{ column: 'id', operator: 'in', value: 'event-type-1' }],
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('Filter "in" expects an array value')
    expect(query.in).not.toHaveBeenCalled()
  })
})
