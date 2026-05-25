import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { id: 'profile-1' } as { id: string } | null,
  endpointRows: [] as Array<Record<string, unknown>>,
  insertPayload: null as Record<string, unknown> | null,
  insertError: null as { code?: string; message: string } | null,
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
  if (table === 'webhook_endpoints') {
    return {
      select: () => ({
        eq: () => ({
          order: async () => ({ data: mocks.endpointRows, error: null }),
        }),
      }),
      insert: (payload: Record<string, unknown>) => {
        mocks.insertPayload = payload
        return {
          select: () => ({
            single: async () => ({
              data: {
                id: 'endpoint-1',
                profile_id: 'profile-1',
                url: payload.url,
                description: payload.description,
                subscribed_events: payload.subscribed_events,
                secret_token: 'secret-token',
                is_active: true,
                created_at: '2026-05-08T00:00:00.000Z',
                updated_at: '2026-05-08T00:00:00.000Z',
              },
              error: mocks.insertError,
            }),
          }),
        }
      },
    }
  }

  throw new Error(`Unexpected admin table: ${table}`)
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

function requestWithJson(body: unknown) {
  return new Request('http://localhost/api/webhooks/endpoints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function requestWithBody(body: string) {
  return new Request('http://localhost/api/webhooks/endpoints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

describe('/api/webhooks/endpoints', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.profile = { id: 'profile-1' }
    mocks.endpointRows = []
    mocks.insertPayload = null
    mocks.insertError = null
  })

  it('creates an endpoint and returns the secret once', async () => {
    const response = await POST(
      requestWithJson({
        url: 'https://example.com/webhook',
        description: 'Production',
        subscribedEvents: ['booking.confirmed'],
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.secretToken).toBe('secret-token')
    expect(data.endpoint).toMatchObject({
      id: 'endpoint-1',
      url: 'https://example.com/webhook',
      subscribedEvents: ['booking.confirmed'],
      isActive: true,
    })
    expect(mocks.insertPayload).toEqual({
      profile_id: 'profile-1',
      url: 'https://example.com/webhook',
      description: 'Production',
      subscribed_events: ['booking.confirmed'],
    })
  })

  it('rejects malformed create bodies before inserting an endpoint', async () => {
    const response = await POST(requestWithBody('{') as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ success: false, error: 'Invalid JSON body' })
    expect(mocks.insertPayload).toBeNull()
  })

  it('lists endpoints without exposing secrets', async () => {
    mocks.endpointRows = [
      {
        id: 'endpoint-1',
        url: 'https://example.com/webhook',
        description: 'Production',
        subscribed_events: ['*'],
        secret_token: 'secret-token',
        is_active: true,
        created_at: '2026-05-08T00:00:00.000Z',
        updated_at: '2026-05-08T00:00:00.000Z',
      },
    ]

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.endpoints).toEqual([
      {
        id: 'endpoint-1',
        url: 'https://example.com/webhook',
        description: 'Production',
        subscribedEvents: ['*'],
        isActive: true,
        createdAt: '2026-05-08T00:00:00.000Z',
        updatedAt: '2026-05-08T00:00:00.000Z',
      },
    ])
    expect(JSON.stringify(data)).not.toContain('secret-token')
  })
})
