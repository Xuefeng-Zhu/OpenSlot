import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, PATCH } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { id: 'profile-1', auth_user_id: 'auth-user-1' } as
    | { id: string; auth_user_id: string }
    | null,
  authUpdateUser: vi.fn(),
  profileUpdatePayload: null as Record<string, unknown> | null,
  profileUpdateError: null as { message: string } | null,
  settingsUpsertPayload: null as Record<string, unknown> | null,
  settingsUpsertOptions: null as Record<string, unknown> | null,
  settingsUpsertError: null as { message: string } | null,
  rpc: vi.fn(),
  rpcSingle: vi.fn(),
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
          eq: async () => ({ error: mocks.profileUpdateError }),
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
    auth: { getUser: mocks.getUser },
    from: createServerTableMock,
  })),
  createAdminBackendClient: vi.fn(() => ({
    auth: {
      updateUser: mocks.authUpdateUser,
      admin: { deleteUser: mocks.deleteUser },
    },
    from: createAdminTableMock,
    rpc: mocks.rpc,
  })),
}))

const accountBody = {
  section: 'account',
  email: 'sarah@example.com',
}

const preferencesBody = {
  section: 'preferences',
  defaultTimezone: 'America/Los_Angeles',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
}

const notificationsBody = {
  section: 'notifications',
  notifyNewBooking: true,
  notifyCancellation: false,
  notifyReminder: true,
}

const legacyBody = {
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
  return { json: async () => body } as Request
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
      data: {
        user: { id: 'auth-user-1', email: 'old@example.com' },
      },
      error: null,
    })
    mocks.profile = { id: 'profile-1', auth_user_id: 'auth-user-1' }
    mocks.authUpdateUser.mockReset()
    mocks.authUpdateUser.mockResolvedValue({ data: { user: null }, error: null })
    mocks.profileUpdatePayload = null
    mocks.profileUpdateError = null
    mocks.settingsUpsertPayload = null
    mocks.settingsUpsertOptions = null
    mocks.settingsUpsertError = null
    mocks.rpc.mockReset()
    mocks.rpc.mockReturnValue({ single: mocks.rpcSingle })
    mocks.rpcSingle.mockReset()
    mocks.rpcSingle.mockResolvedValue({
      data: { success: true },
      error: null,
    })
    mocks.deleteUser.mockReset()
    mocks.deleteUser.mockResolvedValue({ error: null })
  })

  it('fails account email changes closed without writing either store', async () => {
    const response = await PATCH(requestWithJson(accountBody) as any)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data).toEqual({
      success: false,
      code: 'EMAIL_UPDATE_UNAVAILABLE',
      error:
        'Sign-in email changes are temporarily unavailable. Your email was not changed.',
    })
    expect(mocks.authUpdateUser).not.toHaveBeenCalled()
    expect(mocks.profileUpdatePayload).toBeNull()
    expect(mocks.settingsUpsertPayload).toBeNull()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('persists only display preferences and profile timezone', async () => {
    const response = await PATCH(requestWithJson(preferencesBody) as any)

    expect(response.status).toBe(200)
    expect(mocks.authUpdateUser).not.toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('save_dashboard_preferences', {
      p_profile_id: 'profile-1',
      p_default_timezone: 'America/Los_Angeles',
      p_date_format: 'DD/MM/YYYY',
      p_time_format: '24h',
    })
    expect(mocks.rpcSingle).toHaveBeenCalledTimes(1)
    expect(mocks.profileUpdatePayload).toBeNull()
    expect(mocks.settingsUpsertPayload).toBeNull()
  })

  it('returns a safe error when the atomic preference function fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.rpcSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'private database details' },
    })

    const response = await PATCH(requestWithJson(preferencesBody) as any)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      success: false,
      code: 'PREFERENCES_UPDATE_FAILED',
      error: 'Preferences were not changed. Please try again.',
    })
    expect(JSON.stringify(data)).not.toContain('private database details')
    expect(mocks.profileUpdatePayload).toBeNull()
    expect(mocks.settingsUpsertPayload).toBeNull()
    consoleError.mockRestore()
  })

  it('persists only notification preferences', async () => {
    const response = await PATCH(requestWithJson(notificationsBody) as any)

    expect(response.status).toBe(200)
    expect(mocks.authUpdateUser).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.profileUpdatePayload).toBeNull()
    expect(mocks.settingsUpsertPayload).toMatchObject({
      profile_id: 'profile-1',
      notify_new_booking: true,
      notify_cancellation: false,
      notify_reminder: true,
    })
    expect(mocks.settingsUpsertPayload).not.toHaveProperty('date_format')
    expect(mocks.settingsUpsertOptions).toEqual({ onConflict: 'profile_id' })
  })

  it('rejects retired all-section payloads with a reload code', async () => {
    const response = await PATCH(requestWithJson(legacyBody) as any)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data).toEqual({
      success: false,
      code: 'SETTINGS_CLIENT_OUTDATED',
      error: 'This settings page is out of date. Reload it and try again.',
    })
    expect(mocks.authUpdateUser).not.toHaveBeenCalled()
    expect(mocks.profileUpdatePayload).toBeNull()
    expect(mocks.settingsUpsertPayload).toBeNull()
  })

  it('rejects fields owned by another section', async () => {
    const response = await PATCH(
      requestWithJson({ ...notificationsBody, email: 'draft@example.com' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(mocks.profileUpdatePayload).toBeNull()
    expect(mocks.settingsUpsertPayload).toBeNull()
  })

  it('rejects unauthenticated saves', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const response = await PATCH(requestWithJson(accountBody) as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ success: false, error: 'Unauthorized' })
  })

  it('returns field errors for invalid section values', async () => {
    const response = await PATCH(
      requestWithJson({ ...preferencesBody, timeFormat: 'nope' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.details.timeFormat).toBeDefined()
  })

  it('returns the shared invalid JSON error for malformed bodies', async () => {
    const response = await PATCH(requestWithMalformedJson() as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ success: false, error: 'Invalid JSON body' })
    expect(mocks.profileUpdatePayload).toBeNull()
    expect(mocks.settingsUpsertPayload).toBeNull()
  })
})

describe('DELETE /api/settings', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.getUser.mockResolvedValue({
      data: {
        user: { id: 'auth-user-1', email: 'old@example.com' },
      },
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
