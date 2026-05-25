import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, PATCH } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { id: 'profile-1' } as { id: string } | null,
  updatePayload: null as Record<string, unknown> | null,
  updateFilters: [] as Array<{ column: string; value: unknown }>,
  updateData: { id: 'endpoint-1' } as { id: string } | null,
  updateError: null as { message: string } | null,
  deleteFilters: [] as Array<{ column: string; value: unknown }>,
  deleteError: null as { message: string } | null,
}))

function createServerTableMock(table: string) {
  if (table === 'profiles') {
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: mocks.profile,
            error: mocks.profile ? null : { message: 'not found' },
          }),
        }),
      }),
    }
  }

  throw new Error(`Unexpected server table: ${table}`)
}

function createAdminTableMock(table: string) {
  if (table !== 'webhook_endpoints') {
    throw new Error(`Unexpected admin table: ${table}`)
  }

  return {
    update: (payload: Record<string, unknown>) => {
      mocks.updatePayload = payload
      const builder = {
        eq: (column: string, value: unknown) => {
          mocks.updateFilters.push({ column, value })
          return builder
        },
        select: () => ({
          single: async () => ({
            data: mocks.updateData,
            error: mocks.updateError,
          }),
        }),
      }
      return builder
    },
    delete: () => {
      const builder = {
        eq: (column: string, value: unknown) => {
          mocks.deleteFilters.push({ column, value })
          return mocks.deleteFilters.length >= 2
            ? { error: mocks.deleteError }
            : builder
        },
      }
      return builder
    },
  }
}

vi.mock('@/lib/backend/server', () => ({
  createServerBackendClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: createServerTableMock,
  })),
  createAdminBackendClient: vi.fn(() => ({
    from: createAdminTableMock,
  })),
}))

function requestWithJson(body: unknown, method = 'PATCH') {
  return new Request('http://localhost/api/webhooks/endpoints/endpoint-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function requestWithBody(body: string) {
  return new Request('http://localhost/api/webhooks/endpoints/endpoint-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

const endpointParams = { params: Promise.resolve({ id: 'endpoint-1' }) }

describe('/api/webhooks/endpoints/[id]', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.profile = { id: 'profile-1' }
    mocks.updatePayload = null
    mocks.updateFilters = []
    mocks.updateData = { id: 'endpoint-1' }
    mocks.updateError = null
    mocks.deleteFilters = []
    mocks.deleteError = null
  })

  it('rejects malformed update bodies before updating an endpoint', async () => {
    const response = await PATCH(requestWithBody('{') as any, endpointParams)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ success: false, error: 'Invalid JSON body' })
    expect(mocks.updatePayload).toBeNull()
  })

  it('updates only the authenticated profile webhook endpoint', async () => {
    const response = await PATCH(
      requestWithJson({
        description: null,
        isActive: false,
      }) as any,
      endpointParams
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mocks.updatePayload).toMatchObject({
      description: '',
      is_active: false,
    })
    expect(mocks.updatePayload?.updated_at).toEqual(expect.any(String))
    expect(mocks.updateFilters).toEqual([
      { column: 'id', value: 'endpoint-1' },
      { column: 'profile_id', value: 'profile-1' },
    ])
  })

  it('deletes only the authenticated profile webhook endpoint', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/webhooks/endpoints/endpoint-1') as any,
      endpointParams
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mocks.deleteFilters).toEqual([
      { column: 'id', value: 'endpoint-1' },
      { column: 'profile_id', value: 'profile-1' },
    ])
  })
})
