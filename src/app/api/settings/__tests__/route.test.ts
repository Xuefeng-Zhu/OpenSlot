import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, PATCH } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { id: 'profile-1', auth_user_id: 'auth-user-1' } as
    | { id: string; auth_user_id: string }
    | null,
  profileUpdatePayload: null as Record<string, unknown> | null,
  profileUpdateError: null as { message: string } | null,
  settingsUpsertPayload: null as Record<string, unknown> | null,
  settingsUpsertOptions: null as Record<string, unknown> | null,
  settingsUpsertError: null as { message: string } | null,
  deleteUser: vi.fn(),
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
  if (table === 'profiles') {
    return {
      update: (payload: Record<string, unknown>) => {
        mocks.profileUpdatePayload = payload
        return {
          eq: async () => ({
            error: mocks.profileUpdateError,
          }),
        }
      },
    }
  }

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
    auth: {
      admin: {
        deleteUser: mocks.deleteUser,
      },
    },
    from: createAdminTableMock,
  })),
}))

const validBody = {
  name: 'Sarah Chen',
  email: 'sarah@example.com',
  defaultTimezone: 'America/Los_Angeles',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  notifyNewBooking: true,
  notifyCancellation: false,
  notifyReminder: true,
}

function requestWithJson(body: unknown) {
  return {
    json: async () => body,
  } as Request
}

function requestWithMalformedJson() {
  return new Request('http://localhost/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })
}

describe('PATCH /api/settings', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.profile = { id: 'profile-1', auth_user_id: 'auth-user-1' }
    mocks.profileUpdatePayload = null
    mocks.profileUpdateError = null
    mocks.settingsUpsertPayload = null
    mocks.settingsUpsertOptions = null
    mocks.settingsUpsertError = null
    mocks.deleteUser.mockReset()
    mocks.deleteUser.mockResolvedValue({ error: null })
  })

  it('persists profile and settings for the authenticated profile', async () => {
    const response = await PATCH(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mocks.profileUpdatePayload).toMatchObject({
      name: 'Sarah Chen',
      email: 'sarah@example.com',
      default_timezone: 'America/Los_Angeles',
    })
    expect(mocks.settingsUpsertPayload).toMatchObject({
      profile_id: 'profile-1',
      date_format: 'MM/DD/YYYY',
      time_format: '12h',
      notify_new_booking: true,
      notify_cancellation: false,
      notify_reminder: true,
    })
    expect(mocks.settingsUpsertOptions).toEqual({ onConflict: 'profile_id' })
  })

  it('rejects unauthenticated saves', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const response = await PATCH(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ success: false, error: 'Unauthorized' })
  })

  it('returns field errors for invalid settings', async () => {
    const response = await PATCH(
      requestWithJson({ ...validBody, timeFormat: 'nope' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.details.timeFormat).toBeDefined()
  })

  it('returns the shared invalid JSON error for malformed settings bodies', async () => {
    const response = await PATCH(requestWithMalformedJson() as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: 'Invalid JSON body',
    })
    expect(mocks.profileUpdatePayload).toBeNull()
    expect(mocks.settingsUpsertPayload).toBeNull()
  })
})

describe('DELETE /api/settings', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.profile = { id: 'profile-1', auth_user_id: 'auth-user-1' }
    mocks.deleteUser.mockReset()
    mocks.deleteUser.mockResolvedValue({ error: null })
  })

  it('deletes the authenticated Butterbase user', async () => {
    const response = await DELETE()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mocks.deleteUser).toHaveBeenCalledWith('auth-user-1')
  })
})
