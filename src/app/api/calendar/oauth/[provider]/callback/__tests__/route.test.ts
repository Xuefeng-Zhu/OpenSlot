import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { CALENDAR_OAUTH_STATE_COOKIE } from '@/lib/calendar/oauth-state'
import { encodeCalendarOAuthState } from '@/lib/calendar/oauth-state'
import { GET } from '../route'

function routeContext(provider = 'google') {
  return { params: Promise.resolve({ provider }) }
}

function callbackRequest({
  provider = 'google',
  query,
  state = 'state-123',
}: {
  provider?: 'google' | 'microsoft'
  query: string
  state?: string
}) {
  const cookie = encodeCalendarOAuthState({
    provider,
    profileId: 'profile-1',
    state,
  })

  return new NextRequest(
    `http://localhost/api/calendar/oauth/${provider}/callback?${query}&state=${state}`,
    {
      headers: {
        cookie: `${CALENDAR_OAUTH_STATE_COOKIE}=${cookie}`,
      },
    }
  )
}

describe('GET /api/calendar/oauth/[provider]/callback', () => {
  it('redirects provider denials to an allowlisted integrations result', async () => {
    const request = callbackRequest({
      query: 'error=access_denied',
    })

    const response = await GET(request, routeContext())
    const location = new URL(response.headers.get('location') ?? '')

    expect(response.status).toBe(307)
    expect(location.pathname).toBe('/settings')
    expect(Object.fromEntries(location.searchParams)).toEqual({
      tab: 'integrations',
      calendar: 'error',
      provider: 'google',
      reason: 'access_denied',
    })
    expect(response.headers.get('set-cookie')).toContain(
      `${CALENDAR_OAUTH_STATE_COOKIE}=`
    )
  })

  it('does not reflect raw provider errors in the redirect URL', async () => {
    const rawError = 'database credentials and internal host details'
    const request = callbackRequest({
      provider: 'microsoft',
      query: `error=${encodeURIComponent(rawError)}`,
    })

    const response = await GET(request, routeContext('microsoft'))
    const location = response.headers.get('location') ?? ''
    const resultUrl = new URL(location)

    expect(resultUrl.searchParams.get('reason')).toBe('connection_failed')
    expect(location).not.toContain('credentials')
    expect(location).not.toContain('internal')
  })

  it('rejects forged error callbacks without consuming the valid state cookie', async () => {
    const request = new NextRequest(
      'http://localhost/api/calendar/oauth/google/callback?error=access_denied&state=forged'
    )

    const response = await GET(request, routeContext())
    const location = new URL(response.headers.get('location') ?? '')

    expect(location.searchParams.get('reason')).toBe('invalid_state')
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects mismatched callback state without consuming the stored state', async () => {
    const request = callbackRequest({
      query: 'error=access_denied',
      state: 'stored-state',
    })
    const forgedUrl = new URL(request.url)
    forgedUrl.searchParams.set('state', 'different-state')
    const forgedRequest = new NextRequest(forgedUrl, {
      headers: request.headers,
    })

    const response = await GET(forgedRequest, routeContext())
    const location = new URL(response.headers.get('location') ?? '')

    expect(location.searchParams.get('reason')).toBe('invalid_state')
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
