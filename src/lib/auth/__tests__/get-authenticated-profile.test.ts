import { describe, expect, it, vi } from 'vitest'
import { getAuthenticatedProfile } from '../get-authenticated-profile'

function profileClient({
  user = { id: 'auth-user-1', email: 'sarah@example.com' },
  authError = null,
  profile = { id: 'profile-1' },
  profileError = null,
}: {
  user?: { id: string; email: string | null } | null
  authError?: unknown
  profile?: { id: string } | null
  profileError?: unknown
} = {}) {
  const single = vi.fn(async () => ({
    data: profile,
    error: profileError,
  }))
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error: authError,
      })),
    },
    from,
    select,
    eq,
    single,
  }
}

describe('getAuthenticatedProfile', () => {
  it('resolves a provided backend client to the app profile id', async () => {
    const client = profileClient()

    const result = await getAuthenticatedProfile(client as any)

    expect(result).toEqual({
      ok: true,
      profileId: 'profile-1',
      userId: 'auth-user-1',
      email: 'sarah@example.com',
    })
    expect(client.from).toHaveBeenCalledWith('profiles')
    expect(client.eq).toHaveBeenCalledWith('auth_user_id', 'auth-user-1')
  })

  it('returns unauthorized without a profile lookup when the session is missing', async () => {
    const client = profileClient({ user: null })

    const result = await getAuthenticatedProfile(client as any)

    expect(result).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
    expect(client.from).not.toHaveBeenCalled()
  })

  it('returns profile not found when the profile lookup misses', async () => {
    const client = profileClient({
      profile: null,
      profileError: { code: 'PGRST116', message: 'No rows found' },
    })

    const result = await getAuthenticatedProfile(client as any)

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: 'Profile not found',
    })
  })
})
