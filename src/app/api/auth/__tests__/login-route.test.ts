import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../login/route'

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
}))

vi.mock('@/lib/backend/runtime', () => ({
  createBackendRuntime: vi.fn(() => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
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
  cookiesForBackendSession: vi.fn(() => [
    {
      name: 'openslot-access-token',
      value: 'access-token',
      options: {},
    },
  ]),
  cookiesForBackendSignOut: vi.fn(() => mocks.signOutCookies),
  setResponseCookies: mocks.setResponseCookies,
}))

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    mocks.profileUpsertError = null
    mocks.setResponseCookies.mockReset()
    mocks.signInWithPassword.mockReset()
  })

  it('clears stale session cookies when profile synchronization fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mocks.profileUpsertError = { message: 'database unavailable' }
    mocks.signInWithPassword.mockResolvedValue({
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 60_000,
        user: {
          id: 'auth-user-1',
          email: 'host@example.com',
          displayName: 'Host',
        },
      },
      error: null,
    })

    const response = await POST(createLoginRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Unable to prepare your profile. Please try again.',
    })
    expect(mocks.setResponseCookies).toHaveBeenCalledWith(
      response,
      mocks.signOutCookies
    )

    consoleError.mockRestore()
  })
})

function createLoginRequest() {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'host@example.com',
      password: 'password-123',
    }),
    headers: {
      'content-type': 'application/json',
    },
  }) as unknown as NextRequest
}
