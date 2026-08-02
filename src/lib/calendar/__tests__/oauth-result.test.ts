import { describe, expect, it } from 'vitest'
import {
  buildCalendarOAuthSettingsUrl,
  normalizeCalendarOAuthErrorReason,
  parseCalendarOAuthResult,
} from '@/lib/calendar/oauth-result'

describe('calendar OAuth result contract', () => {
  it('builds a safe integrations redirect for successful connections', () => {
    const url = buildCalendarOAuthSettingsUrl('https://openslot.example', {
      status: 'connected',
      provider: 'google',
    })

    expect(url.pathname).toBe('/settings')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      tab: 'integrations',
      calendar: 'connected',
      provider: 'google',
    })
  })

  it('maps provider failures to allowlisted reasons without retaining details', () => {
    expect(normalizeCalendarOAuthErrorReason('access_denied')).toBe(
      'access_denied'
    )
    expect(normalizeCalendarOAuthErrorReason('temporarily_unavailable')).toBe(
      'provider_unavailable'
    )
    expect(
      normalizeCalendarOAuthErrorReason('database password leaked in error')
    ).toBe('connection_failed')

    const url = buildCalendarOAuthSettingsUrl('https://openslot.example', {
      status: 'error',
      provider: 'microsoft',
      reason: 'connection_failed',
    })

    expect(Object.fromEntries(url.searchParams)).toEqual({
      tab: 'integrations',
      calendar: 'error',
      provider: 'microsoft',
      reason: 'connection_failed',
    })
  })

  it('parses new results and the legacy success marker only', () => {
    expect(
      parseCalendarOAuthResult(
        new URLSearchParams(
          'tab=integrations&calendar=error&provider=google&reason=access_denied'
        )
      )
    ).toEqual({
      status: 'error',
      provider: 'google',
      reason: 'access_denied',
    })

    expect(
      parseCalendarOAuthResult(
        new URLSearchParams('calendar=connected&detail=microsoft')
      )
    ).toEqual({ status: 'connected', provider: 'microsoft' })

    expect(
      parseCalendarOAuthResult(
        new URLSearchParams(
          'calendar=error&detail=raw%20provider%20exception'
        )
      )
    ).toBeNull()
  })
})
