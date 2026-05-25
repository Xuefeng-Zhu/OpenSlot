import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../exchange-code/route'

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  profileUpsertError: null as { message: string } | null,
  signOutCookies: [
    {
      name: 'openslot_backend_access_token',
      value: '',
      options: { path: '/', maxAge: 0 },
    },
  ],
  setResponseCookies: vi.fn(),
}))

vi.mock('@/lib/backend/compat/query-client', () => ({
  createBackendCompatClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
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

describe('POST /api/auth/exchange-code', () => {
  beforeEach(() => {
    mocks.exchangeCodeForSession.mockReset()
    mocks.profileUpsertError = null
    mocks.setResponseCookies.mockReset()
  })

  it('clears stale session cookies when profile synchronization fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mocks.profileUpsertError = { message: 'database unavailable' }
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: {
          id: 'auth-user-1',
          email: 'host@example.com',
          user_metadata: { full_name: 'Host' },
        },
      },
      error: null,
    })

    const response = await POST(createExchangeRequest())

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

function createExchangeRequest() {
  return new Request('http://localhost/api/auth/exchange-code', {
    method: 'POST',
    body: JSON.stringify({
      code: 'auth-code',
    }),
    headers: {
      'content-type': 'application/json',
    },
  }) as unknown as NextRequest
}
