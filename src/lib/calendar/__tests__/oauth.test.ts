import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildCalendarAuthorizationUrl,
  exchangeCalendarAuthorizationCode,
  fetchCalendarProviderIdentity,
  refreshCalendarAccessToken,
} from '../oauth'

describe('calendar OAuth helpers', () => {
  const originalEnv = {
    GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  }

  afterEach(() => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = originalEnv.GOOGLE_CALENDAR_CLIENT_ID
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET =
      originalEnv.GOOGLE_CALENDAR_CLIENT_SECRET
  })

  it('builds Google authorization URLs with offline calendar access', () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'google-client'
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'google-secret'

    const url = buildCalendarAuthorizationUrl({
      provider: 'google',
      redirectUri: 'http://localhost/api/calendar/oauth/google/callback',
      state: 'state-value',
    })

    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('client_id')).toBe('google-client')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('scope')).toContain(
      'https://www.googleapis.com/auth/calendar.events'
    )
  })

  it('exchanges an authorization code for normalized tokens', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'google-client'
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'google-secret'
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          scope: 'openid email',
          token_type: 'Bearer',
        }),
        { status: 200 }
      )
    )

    const tokens = await exchangeCalendarAuthorizationCode({
      provider: 'google',
      code: 'code',
      redirectUri: 'http://localhost/callback',
      fetchImpl: fetchImpl as typeof fetch,
    })

    expect(tokens).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      scopes: ['openid', 'email'],
      tokenType: 'Bearer',
    })
    expect(tokens.expiresAt).toEqual(expect.any(String))
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('rejects malformed successful token exchange responses', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'google-client'
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'google-secret'
    const fetchImpl = vi.fn(async () => new Response('not json', { status: 200 }))

    await expect(
      exchangeCalendarAuthorizationCode({
        provider: 'google',
        code: 'code',
        redirectUri: 'http://localhost/callback',
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).rejects.toThrow('Calendar token exchange returned malformed JSON')
  })

  it('rejects malformed successful token refresh responses', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'google-client'
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'google-secret'
    const fetchImpl = vi.fn(async () => new Response('not json', { status: 200 }))

    await expect(
      refreshCalendarAccessToken({
        provider: 'google',
        refreshToken: 'refresh-token',
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).rejects.toThrow('Calendar token refresh returned malformed JSON')
  })

  it('uses provider HTTP fallback errors for malformed identity responses', async () => {
    const fetchImpl = vi.fn(async () => new Response('upstream unavailable', { status: 500 }))

    await expect(
      fetchCalendarProviderIdentity({
        provider: 'google',
        accessToken: 'access-token',
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).rejects.toThrow('Provider request failed with HTTP 500')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: 'Bearer access-token' },
      }
    )
  })
})
