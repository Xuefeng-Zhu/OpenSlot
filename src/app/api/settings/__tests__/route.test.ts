import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, PATCH } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { id: 'profile-1', auth_user_id: 'auth-user-1' } as
    | { id: string; auth_user_id: string }
    | null,
  authUpdateUser: vi.fn(),
  profileUpdatePayload: null as Record<string, unknown> | null,
  profileUpdatePayloads: [] as Array<Record<string, unknown>>,
  profileUpdateError: null as { message: string } | null,
  profileRollbackError: null as { message: string } | null,
  previousTimezone: 'America/New_York' as string | null,
  previousProfileError: null as { message: string } | null,
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
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: mocks.previousProfileError
              ? null
              : { default_timezone: mocks.previousTimezone },
            error: mocks.previousProfileError,
          }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        mocks.profileUpdatePayload = payload
        mocks.profileUpdatePayloads.push(payload)
        const updateError =
          mocks.profileUpdatePayloads.length === 1
            ? mocks.profileUpdateError
            : mocks.profileRollbackError
        return {
          eq: async () => ({ error: updateError }),
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
    mocks.profileUpdatePayloads = []
    mocks.profileUpdateError = null
    mocks.profileRollbackError = null
    mocks.previousTimezone = 'America/New_York'
    mocks.previousProfileError = null
    mocks.settingsUpsertPayload = null
    mocks.settingsUpsertOptions = null
    mocks.settingsUpsertError = null
    mocks.deleteUser.mockReset()
    mocks.deleteUser.mockResolvedValue({ error: null })
  })

  it('synchronizes only the account email section', async () => {
    const response = await PATCH(requestWithJson(accountBody) as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true, email: 'sarah@example.com' })
    expect(mocks.authUpdateUser).toHaveBeenCalledWith({
      userId: 'auth-user-1',
      email: 'sarah@example.com',
    })
    expect(mocks.profileUpdatePayload).toMatchObject({
      email: 'sarah@example.com',
    })
    expect(mocks.settingsUpsertPayload).toBeNull()
  })

  it('persists only display preferences and profile timezone', async () => {
    const response = await PATCH(requestWithJson(preferencesBody) as any)

    expect(response.status).toBe(200)
    expect(mocks.authUpdateUser).not.toHaveBeenCalled()
    expect(mocks.profileUpdatePayload).toMatchObject({
      default_timezone: 'America/Los_Angeles',
    })
    expect(mocks.profileUpdatePayload).not.toHaveProperty('email')
    expect(mocks.settingsUpsertPayload).toMatchObject({
      profile_id: 'profile-1',
      date_format: 'DD/MM/YYYY',
      time_format: '24h',
    })
    expect(mocks.settingsUpsertPayload).not.toHaveProperty(
      'notify_new_booking'
    )
    expect(mocks.profileUpdatePayloads).toHaveLength(1)
  })

  it('does not write display settings when the profile timezone update fails', async () => {
    mocks.profileUpdateError = { message: 'profile write failed' }

    const response = await PATCH(requestWithJson(preferencesBody) as any)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      success: false,
      error: 'Failed to update preferences',
    })
    expect(mocks.settingsUpsertPayload).toBeNull()
    expect(mocks.profileUpdatePayloads).toHaveLength(1)
  })

  it('restores the previous timezone when display settings fail to save', async () => {
    mocks.settingsUpsertError = { message: 'settings write failed' }

    const response = await PATCH(requestWithJson(preferencesBody) as any)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      success: false,
      code: 'PREFERENCES_UPDATE_FAILED',
      error: 'Preferences were not changed. Please try again.',
    })
    expect(mocks.profileUpdatePayloads).toHaveLength(2)
    expect(mocks.profileUpdatePayloads[1]).toMatchObject({
      default_timezone: 'America/New_York',
    })
  })

  it('reports when a failed display-settings save cannot restore the timezone', async () => {
    mocks.settingsUpsertError = { message: 'settings write failed' }
    mocks.profileRollbackError = { message: 'rollback failed' }

    const response = await PATCH(requestWithJson(preferencesBody) as any)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      success: false,
      code: 'PREFERENCES_RECONCILIATION_REQUIRED',
      error: 'Preferences could not be synchronized. Reload before retrying.',
    })
    expect(mocks.profileUpdatePayloads).toHaveLength(2)
  })

  it('does not change preferences when their current timezone cannot be loaded', async () => {
    mocks.previousProfileError = { message: 'read failed' }

    const response = await PATCH(requestWithJson(preferencesBody) as any)

    expect(response.status).toBe(500)
    expect(mocks.profileUpdatePayloads).toHaveLength(0)
    expect(mocks.settingsUpsertPayload).toBeNull()
  })

  it('persists only notification preferences', async () => {
    const response = await PATCH(requestWithJson(notificationsBody) as any)

    expect(response.status).toBe(200)
    expect(mocks.authUpdateUser).not.toHaveBeenCalled()
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
