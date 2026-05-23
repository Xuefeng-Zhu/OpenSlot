import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BACKEND_ACCESS_TOKEN_COOKIE,
  BACKEND_REFRESH_TOKEN_COOKIE,
} from '@/lib/backend/session'
import { createBackendRuntime } from '@/lib/backend/runtime'
import { proxy } from '@/proxy'

vi.mock('@/lib/backend/runtime', () => ({
  createBackendRuntime: vi.fn(),
}))

describe('proxy session refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_BUTTERBASE_APP_ID', 'app_test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('propagates refreshed auth cookies to the same request', async () => {
    vi.mocked(createBackendRuntime).mockImplementation((options?: any) => {
      if (options?.accessToken) {
        return {
          auth: {
            getCurrentUser: vi.fn(async () => ({
              data: null,
              error: { message: 'expired' },
            })),
          },
        } as any
      }

      return {
        auth: {
          refreshSession: vi.fn(async () => ({
            data: {
              accessToken: 'new-access-token',
              refreshToken: 'new-refresh-token',
              expiresIn: 3600,
              user: {
                id: 'user-1',
                email: 'host@example.com',
              },
            },
            error: null,
          })),
        },
      } as any
    })

    const request = new NextRequest('https://openslot.test/dashboard', {
      headers: {
        cookie: `${BACKEND_ACCESS_TOKEN_COOKIE}=expired-token; ${BACKEND_REFRESH_TOKEN_COOKIE}=refresh-token; other=value`,
      },
    })

    const response = await proxy(request)
    const forwardedCookieHeader = response.headers.get(
      'x-middleware-request-cookie'
    )

    expect(forwardedCookieHeader).toContain(
      `${BACKEND_ACCESS_TOKEN_COOKIE}=new-access-token`
    )
    expect(forwardedCookieHeader).toContain(
      `${BACKEND_REFRESH_TOKEN_COOKIE}=new-refresh-token`
    )
    expect(forwardedCookieHeader).toContain('other=value')
    expect(response.cookies.get(BACKEND_ACCESS_TOKEN_COOKIE)?.value).toBe(
      'new-access-token'
    )
  })
})
