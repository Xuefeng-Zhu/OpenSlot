import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKEND_ACCESS_TOKEN_COOKIE } from '@/lib/backend/session'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  currentAccessToken: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/backend/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backend/server')>()

  return {
    ...actual,
    currentBackendAccessToken: mocks.currentAccessToken,
  }
})

vi.mock('@/lib/backend/runtime', () => ({
  createBackendRuntime: vi.fn(() => ({
    auth: { signOut: mocks.signOut },
  })),
}))

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears local cookies when no remote session token remains', async () => {
    mocks.currentAccessToken.mockResolvedValue(null)

    const response = await POST()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(response.headers.get('set-cookie')).toContain(
      BACKEND_ACCESS_TOKEN_COOKIE
    )
  })

  it('clears local cookies after remote sign-out succeeds', async () => {
    mocks.currentAccessToken.mockResolvedValue('access-token')
    mocks.signOut.mockResolvedValue({
      data: { success: true },
      error: null,
    })

    const response = await POST()

    expect(response.status).toBe(200)
    expect(mocks.signOut).toHaveBeenCalledWith('access-token')
    expect(response.headers.get('set-cookie')).toContain(
      BACKEND_ACCESS_TOKEN_COOKIE
    )
  })

  it('fails safely without clearing cookies when remote sign-out fails', async () => {
    mocks.currentAccessToken.mockResolvedValue('access-token')
    mocks.signOut.mockResolvedValue({
      data: null,
      error: { message: 'raw Butterbase session failure', status: 500 },
    })

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      success: false,
      error: 'Unable to sign out. Please try again.',
    })
    expect(JSON.stringify(body)).not.toContain('Butterbase')
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it.each([401, 404])(
    'clears stale cookies when the remote session is already absent (%s)',
    async (status) => {
      mocks.currentAccessToken.mockResolvedValue('stale-access-token')
      mocks.signOut.mockResolvedValue({
        data: null,
        error: { message: 'remote session missing', status },
      })

      const response = await POST()

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true })
      expect(response.headers.get('set-cookie')).toContain(
        BACKEND_ACCESS_TOKEN_COOKIE
      )
    }
  )
})
