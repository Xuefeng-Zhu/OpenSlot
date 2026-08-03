import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from '../route'

const mocks = vi.hoisted(() => ({
  currentAccessToken: vi.fn(),
  getAuthenticatedProfile: vi.fn(),
}))

vi.mock('@/lib/backend/server', () => ({
  currentBackendAccessToken: mocks.currentAccessToken,
}))

vi.mock('@/lib/backend/compat/query-client', () => ({
  createBackendCompatClient: vi.fn(() => ({
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  })),
}))

vi.mock('@/lib/auth/get-authenticated-profile', () => ({
  getAuthenticatedProfile: mocks.getAuthenticatedProfile,
}))

function requestWithJson(body: unknown) {
  return { json: async () => body } as Request
}

describe('PATCH /api/auth/update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentAccessToken.mockResolvedValue('access-token')
    mocks.getAuthenticatedProfile.mockResolvedValue({
      ok: true,
      userId: 'user-1',
      profileId: 'profile-1',
      email: 'old@example.com',
    })
  })

  it('rejects combined email and password mutations', async () => {
    const response = await PATCH(
      requestWithJson({
        email: 'new@example.com',
        password: 'Newpass1!',
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      success: false,
      code: 'COMBINED_ACCOUNT_UPDATE_NOT_ALLOWED',
      error:
        'Sign-in email changes are unavailable. Use the password reset flow to change your password.',
      details: { resetPath: '/forgot-password' },
    })
    expect(mocks.getAuthenticatedProfile).not.toHaveBeenCalled()
  })

  it('fails email updates closed without invoking privileged auth', async () => {
    const response = await PATCH(
      requestWithJson({ email: ' New@Example.com ' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data).toEqual({
      success: false,
      code: 'EMAIL_UPDATE_UNAVAILABLE',
      error:
        'Sign-in email changes are temporarily unavailable. Your email was not changed.',
    })
    expect(mocks.getAuthenticatedProfile).toHaveBeenCalledOnce()
  })

  it('requires an authenticated session before returning capability guidance', async () => {
    mocks.getAuthenticatedProfile.mockResolvedValue({
      ok: false,
      status: 401,
      error: 'Authentication required.',
    })

    const response = await PATCH(
      requestWithJson({ email: 'new@example.com' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({
      success: false,
      error: 'Authentication required.',
    })
  })

  it.each(['', 'short', 'Newpass1!'])(
    'directs password mutation %j to the supported reset flow',
    async (password) => {
      const response = await PATCH(requestWithJson({ password }) as any)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toEqual({
        success: false,
        code: 'PASSWORD_RESET_REQUIRED',
        error: 'Use the password reset flow to change your password.',
        details: { resetPath: '/forgot-password' },
      })
      expect(mocks.getAuthenticatedProfile).toHaveBeenCalledOnce()
    }
  )

  it('rejects requests without an active session', async () => {
    mocks.currentAccessToken.mockResolvedValue(null)

    const response = await PATCH(
      requestWithJson({ email: 'new@example.com' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({
      success: false,
      error: 'Authentication required.',
    })
    expect(mocks.getAuthenticatedProfile).not.toHaveBeenCalled()
  })

  it('rejects requests without an account mutation', async () => {
    const response = await PATCH(requestWithJson({ displayName: 'Host' }) as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: 'No account changes were provided.',
    })
    expect(mocks.getAuthenticatedProfile).not.toHaveBeenCalled()
  })
})
