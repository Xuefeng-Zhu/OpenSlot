import { describe, expect, it, vi } from 'vitest'
import { createButterbaseBackend } from '@/lib/backend/butterbase/adapter'

describe('Butterbase backend adapter', () => {
  it('maps password sign-in to Butterbase auth without service credentials', async () => {
    const fetchImpl = mockFetch({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      user: {
        id: 'auth-user-1',
        email: 'host@example.com',
        email_verified: true,
        display_name: 'Host',
        avatar_url: null,
      },
    })
    const backend = createButterbaseBackend({
      appId: 'app_openslot',
      apiUrl: 'https://api.butterbase.ai',
      apiKey: 'service-key',
      accessToken: 'caller-token',
      fetchImpl,
    })

    const result = await backend.auth.signInWithPassword({
      email: 'host@example.com',
      password: 'Passw0rd!',
    })

    expect(result.data?.accessToken).toBe('access-token')
    expect(result.data?.user).toMatchObject({
      id: 'auth-user-1',
      email: 'host@example.com',
      emailVerified: true,
      displayName: 'Host',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.butterbase.ai/auth/app_openslot/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'host@example.com',
          password: 'Passw0rd!',
        }),
      })
    )
    expect(requestHeaders(fetchImpl).get('Authorization')).toBeNull()
  })

  it('maps current user responses from Butterbase auth', async () => {
    const fetchImpl = mockFetch({
      user: {
        id: 'auth-user-1',
        email: 'host@example.com',
        email_verified: true,
        display_name: 'Host',
        avatar_url: null,
      },
    })
    const backend = createButterbaseBackend({
      appId: 'app_openslot',
      apiUrl: 'https://api.butterbase.ai',
      apiKey: 'service-key',
      fetchImpl,
    })

    const result = await backend.auth.getCurrentUser('caller-token')

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      id: 'auth-user-1',
      email: 'host@example.com',
      emailVerified: true,
      displayName: 'Host',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.butterbase.ai/auth/app_openslot/me',
      expect.anything()
    )
    expect(requestHeaders(fetchImpl).get('Authorization')).toBe(
      'Bearer caller-token'
    )
  })

  it('hydrates the user after Butterbase refresh rotates token-only responses', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'refreshed-access-token',
            refresh_token: 'refreshed-refresh-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              id: 'auth-user-1',
              email: 'host@example.com',
              email_verified: true,
              display_name: 'Host',
              avatar_url: null,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    const backend = createButterbaseBackend({
      appId: 'app_openslot',
      apiUrl: 'https://api.butterbase.ai',
      apiKey: 'service-key',
      fetchImpl,
    })

    const result = await backend.auth.refreshSession('stale-access-refresh-token')

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      accessToken: 'refreshed-access-token',
      refreshToken: 'refreshed-refresh-token',
      user: { id: 'auth-user-1', email: 'host@example.com' },
    })
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://api.butterbase.ai/auth/app_openslot/me',
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    )
    expect(
      new Headers(fetchImpl.mock.calls[1][1]?.headers).get('Authorization')
    ).toBe('Bearer refreshed-access-token')
  })

  it('maps wrapped signup user responses from Butterbase auth', async () => {
    const fetchImpl = mockFetch({
      user: {
        id: 'auth-user-2',
        email: 'new-host@example.com',
        email_verified: false,
        display_name: 'New Host',
        avatar_url: null,
      },
    })
    const backend = createButterbaseBackend({
      appId: 'app_openslot',
      apiUrl: 'https://api.butterbase.ai',
      apiKey: 'service-key',
      fetchImpl,
    })

    const result = await backend.auth.signUp({
      email: 'new-host@example.com',
      password: 'Passw0rd!',
      displayName: 'New Host',
    })

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      id: 'auth-user-2',
      email: 'new-host@example.com',
      emailVerified: false,
      displayName: 'New Host',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.butterbase.ai/auth/app_openslot/signup',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'new-host@example.com',
          password: 'Passw0rd!',
          display_name: 'New Host',
        }),
      })
    )
    expect(requestHeaders(fetchImpl).get('Authorization')).toBeNull()
  })

  it('treats empty current user responses as unauthorized', async () => {
    const fetchImpl = mockFetch(null)
    const backend = createButterbaseBackend({
      appId: 'app_openslot',
      apiUrl: 'https://api.butterbase.ai',
      apiKey: 'service-key',
      fetchImpl,
    })

    const result = await backend.auth.getCurrentUser('stale-token')

    expect(result.data).toBeNull()
    expect(result.error).toMatchObject({
      message: 'Unauthorized',
      status: 401,
    })
  })

  it('maps data list filters to Butterbase REST query parameters', async () => {
    const fetchImpl = mockFetch([])
    const backend = createButterbaseBackend({
      appId: 'app_openslot',
      apiUrl: 'https://api.butterbase.ai',
      apiKey: 'service-key',
      accessToken: 'caller-token',
      fetchImpl,
    })

    await backend.data.list('profiles', {
      select: 'id,email',
      filters: [{ column: 'email', operator: 'eq', value: 'host@example.com' }],
      order: 'created_at.desc',
      limit: 10,
      offset: 20,
    })

    const url = String(fetchImpl.mock.calls[0][0])
    expect(url).toContain('https://api.butterbase.ai/v1/app_openslot/profiles?')
    expect(url).toContain('select=id%2Cemail')
    expect(url).toContain('email=eq.host%40example.com')
    expect(url).toContain('order=created_at.desc')
    expect(url).toContain('limit=10')
    expect(url).toContain('offset=20')
    expect(requestHeaders(fetchImpl).get('Authorization')).toBe(
      'Bearer caller-token'
    )
  })

  it('uses service credentials for explicit service-key data calls', async () => {
    const fetchImpl = mockFetch([])
    const backend = createButterbaseBackend({
      appId: 'app_openslot',
      apiUrl: 'https://api.butterbase.ai',
      apiKey: 'service-key',
      accessToken: 'caller-token',
      fetchImpl,
    })

    await backend.data.list('profiles', { serviceRole: true })

    expect(requestHeaders(fetchImpl).get('Authorization')).toBe(
      'Bearer service-key'
    )
  })

  it('maps transaction ports to stable Butterbase function slugs', async () => {
    const fetchImpl = mockFetch({
      success: true,
      holdId: 'hold-1',
      holdToken: 'hold-token-1',
      expiresAt: '2026-05-20T18:00:00.000Z',
    })
    const backend = createButterbaseBackend({
      appId: 'app_openslot',
      apiUrl: 'https://api.butterbase.ai',
      apiKey: 'service-key',
      functionSecret: 'function-secret',
      fetchImpl,
    })

    await backend.transactions.createSlotHold({
      eventTypeId: 'event-type-1',
      hostUserId: 'profile-1',
      startAt: '2026-05-20T17:00:00.000Z',
      endAt: '2026-05-20T17:30:00.000Z',
      guestEmail: 'guest@example.com',
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.butterbase.ai/v1/app_openslot/fn/create-slot-hold',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          eventTypeId: 'event-type-1',
          hostUserId: 'profile-1',
          startAt: '2026-05-20T17:00:00.000Z',
          endAt: '2026-05-20T17:30:00.000Z',
          guestEmail: 'guest@example.com',
        }),
      })
    )
    expect(requestHeaders(fetchImpl).get('Authorization')).toBe(
      'Bearer service-key'
    )
  })

  it.each([
    ['createSlotHold', 'create-slot-hold'],
    ['consumePublicRateLimit', 'consume-public-rate-limit'],
    ['refreshProviderToken', 'refresh-provider-token'],
    ['saveAvailability', 'save-availability'],
    ['saveDashboardPreferences', 'save-dashboard-preferences'],
  ] as const)(
    'uses the platform service key for %s',
    async (functionName, slug) => {
      const fetchImpl = mockFetch({ success: true })
      const backend = createButterbaseBackend({
        appId: 'app_openslot',
        apiUrl: 'https://api.butterbase.ai',
        apiKey: 'service-key',
        functionSecret: 'function-secret',
        fetchImpl,
      })

      await backend.functions.invoke(functionName, {
        body: {},
        serviceRole: true,
      })

      expect(fetchImpl).toHaveBeenCalledWith(
        `https://api.butterbase.ai/v1/app_openslot/fn/${slug}`,
        expect.objectContaining({ method: 'POST' })
      )
      expect(requestHeaders(fetchImpl).get('Authorization')).toBe(
        'Bearer service-key'
      )
    }
  )
})

function mockFetch(body: unknown, init: ResponseInit = {}) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
  })
}

function requestHeaders(fetchImpl: ReturnType<typeof mockFetch>): Headers {
  return fetchImpl.mock.calls[0]?.[1]?.headers as Headers
}
