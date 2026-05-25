import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../signup/route'

const mocks = vi.hoisted(() => ({
  profileUpsertError: null as { message: string } | null,
  signOutCookies: [
    {
      name: 'openslot_backend_access_token',
      value: '',
      options: { path: '/', maxAge: 0 },
    },
  ],
  setResponseCookies: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('@/lib/backend/runtime', () => ({
  createBackendRuntime: vi.fn(() => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
    },
  })),
}))

vi.mock('@/lib/backend/server', () => ({
  createAdminBackendClient: vi.fn(() => ({
    from: (table: string) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        upsert: vi.fn(() =>
          Promise.resolve({ data: null, error: mocks.profileUpsertError })
        ),
      }
    },
  })),
  cookiesForBackendSession: vi.fn(() => []),
  cookiesForBackendSignOut: vi.fn(() => mocks.signOutCookies),
  setResponseCookies: mocks.setResponseCookies,
}))

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    mocks.profileUpsertError = null
    mocks.setResponseCookies.mockReset()
    mocks.signInWithPassword.mockReset()
    mocks.signUp.mockReset()
  })

  it('returns requiresLogin when profile synchronization fails after auth signup', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const user = {
      id: 'auth-user-1',
      email: 'host@example.com',
      displayName: 'Host',
    }
    mocks.profileUpsertError = { message: 'database unavailable' }
    mocks.signUp.mockResolvedValue({
      data: user,
      error: null,
    })

    const response = await POST(createSignupRequest())

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({
      success: true,
      requiresLogin: true,
      user,
    })
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
    expect(mocks.setResponseCookies).toHaveBeenCalledWith(
      response,
      mocks.signOutCookies
    )

    consoleError.mockRestore()
  })
})

function createSignupRequest() {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: 'host@example.com',
      password: 'password-123',
      displayName: 'Host',
    }),
    headers: {
      'content-type': 'application/json',
    },
  }) as unknown as NextRequest
}
