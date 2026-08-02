import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PASSWORD_COMPLEXITY_ERROR } from '@/lib/validations/password'
import { PATCH } from '../route'

const mocks = vi.hoisted(() => ({
  currentAccessToken: vi.fn(),
  getAuthenticatedProfile: vi.fn(),
  syncAccountEmail: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('@/lib/backend/server', () => ({
  currentBackendAccessToken: mocks.currentAccessToken,
  createAdminBackendClient: vi.fn(() => ({
    auth: { updateUser: mocks.updateUser },
  })),
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

vi.mock('@/lib/auth/sync-account-email', () => ({
  syncAccountEmail: mocks.syncAccountEmail,
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
    mocks.syncAccountEmail.mockResolvedValue({
      ok: true,
      email: 'new@example.com',
    })
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: null })
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
      error: 'Update email and password separately.',
    })
    expect(mocks.getAuthenticatedProfile).not.toHaveBeenCalled()
  })

  it.each(['', 'short', 'lowercase1!'])(
    'rejects weak password updates before calling privileged auth for %j',
    async (password) => {
      const response = await PATCH(requestWithJson({ password }) as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({
        success: false,
        error: PASSWORD_COMPLEXITY_ERROR,
      })
      expect(mocks.getAuthenticatedProfile).not.toHaveBeenCalled()
      expect(mocks.updateUser).not.toHaveBeenCalled()
    }
  )

  it('uses the compensated server email synchronization helper', async () => {
    const response = await PATCH(
      requestWithJson({ email: ' New@Example.com ' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      user: null,
      email: 'new@example.com',
    })
    expect(mocks.syncAccountEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        profileId: 'profile-1',
        currentEmail: 'old@example.com',
        nextEmail: 'new@example.com',
      })
    )
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('returns safe reconciliation errors from email synchronization', async () => {
    mocks.syncAccountEmail.mockResolvedValue({
      ok: false,
      status: 500,
      code: 'EMAIL_RECONCILIATION_REQUIRED',
      error: 'Account email needs support reconciliation.',
    })

    const response = await PATCH(
      requestWithJson({ email: 'new@example.com' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      success: false,
      code: 'EMAIL_RECONCILIATION_REQUIRED',
      error: 'Account email needs support reconciliation.',
    })
  })

  it('keeps password updates separate from profile email writes', async () => {
    const response = await PATCH(
      requestWithJson({ password: 'Newpass1!' }) as any
    )

    expect(response.status).toBe(200)
    expect(mocks.updateUser).toHaveBeenCalledWith({
      userId: 'user-1',
      password: 'Newpass1!',
    })
    expect(mocks.syncAccountEmail).not.toHaveBeenCalled()
  })
})
