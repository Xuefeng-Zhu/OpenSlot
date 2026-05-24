import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { id: 'profile-1' } as { id: string } | null,
  settingsUpsertPayload: null as Record<string, unknown> | null,
  settingsUpsertOptions: null as Record<string, unknown> | null,
  settingsUpsertError: null as { message: string } | null,
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
  if (table === 'user_settings') {
    return {
      upsert: (
        payload: Record<string, unknown>,
        options: Record<string, unknown>
      ) => {
        mocks.settingsUpsertPayload = payload
        mocks.settingsUpsertOptions = options
        return Promise.resolve({ error: mocks.settingsUpsertError })
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/notifications/seen', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.profile = { id: 'profile-1' }
    mocks.settingsUpsertPayload = null
    mocks.settingsUpsertOptions = null
    mocks.settingsUpsertError = null
  })

  it('marks dashboard notifications seen for the authenticated profile', async () => {
    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(typeof data.notificationsSeenAt).toBe('string')
    expect(mocks.settingsUpsertPayload).toMatchObject({
      profile_id: 'profile-1',
      notifications_seen_at: data.notificationsSeenAt,
      updated_at: data.notificationsSeenAt,
    })
    expect(mocks.settingsUpsertOptions).toEqual({ onConflict: 'profile_id' })
  })

  it('rejects unauthenticated requests', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ success: false, error: 'Unauthorized' })
    expect(mocks.settingsUpsertPayload).toBeNull()
  })

  it('returns a server error when the seen timestamp cannot be saved', async () => {
    mocks.settingsUpsertError = { message: 'database unavailable' }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      success: false,
      error: 'Failed to mark notifications as read',
    })
  })
})
