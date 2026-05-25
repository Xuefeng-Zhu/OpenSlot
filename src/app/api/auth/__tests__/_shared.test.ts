import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureProfileForAuthUser } from '../_shared'

const mocks = vi.hoisted(() => ({
  profileUpsertPayload: null as Record<string, unknown> | null,
  profileUpsertOptions: null as Record<string, unknown> | null,
  profileUpsertError: null as { message: string } | null,
}))

vi.mock('@/lib/backend/server', () => ({
  createAdminBackendClient: vi.fn(() => ({
    from: (table: string) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        upsert: (
          payload: Record<string, unknown>,
          options: Record<string, unknown>
        ) => {
          mocks.profileUpsertPayload = payload
          mocks.profileUpsertOptions = options
          return Promise.resolve({ data: null, error: mocks.profileUpsertError })
        },
      }
    },
  })),
  cookiesForBackendSession: vi.fn(() => []),
  cookiesForBackendSignOut: vi.fn(() => []),
  setResponseCookies: vi.fn(),
}))

describe('ensureProfileForAuthUser', () => {
  beforeEach(() => {
    mocks.profileUpsertPayload = null
    mocks.profileUpsertOptions = null
    mocks.profileUpsertError = null
  })

  it('does not overwrite an existing profile name when auth has no display name', async () => {
    await ensureProfileForAuthUser({
      authUserId: 'auth-user-1',
      email: 'host@example.com',
      displayName: null,
    })

    expect(mocks.profileUpsertPayload).toMatchObject({
      auth_user_id: 'auth-user-1',
      email: 'host@example.com',
      updated_at: expect.any(String),
    })
    expect(mocks.profileUpsertPayload).not.toHaveProperty('name')
    expect(mocks.profileUpsertOptions).toEqual({ onConflict: 'auth_user_id' })
  })

  it('does not overwrite an existing profile name when auth has a blank display name', async () => {
    await ensureProfileForAuthUser({
      authUserId: 'auth-user-1',
      email: 'host@example.com',
      displayName: '   ',
    })

    expect(mocks.profileUpsertPayload).not.toHaveProperty('name')
  })

  it('updates the profile name when auth has a non-empty display name', async () => {
    await ensureProfileForAuthUser({
      authUserId: 'auth-user-1',
      email: 'host@example.com',
      displayName: '  Sarah Chen  ',
    })

    expect(mocks.profileUpsertPayload).toMatchObject({
      auth_user_id: 'auth-user-1',
      email: 'host@example.com',
      name: 'Sarah Chen',
      updated_at: expect.any(String),
    })
  })

  it('returns a safe failure when profile synchronization fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mocks.profileUpsertError = { message: 'database unavailable' }

    await expect(
      ensureProfileForAuthUser({
        authUserId: 'auth-user-1',
        email: 'host@example.com',
        displayName: 'Sarah Chen',
      })
    ).resolves.toEqual({
      ok: false,
      error: 'Unable to prepare your profile. Please try again.',
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Error ensuring auth profile:',
      mocks.profileUpsertError
    )

    consoleError.mockRestore()
  })
})
