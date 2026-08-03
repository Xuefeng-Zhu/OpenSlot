import {
  parseCalendarProvider,
  type CalendarProvider,
} from '@/lib/calendar/oauth'

export const CALENDAR_OAUTH_ERROR_REASONS = [
  'access_denied',
  'invalid_state',
  'provider_mismatch',
  'unauthorized',
  'profile_mismatch',
  'provider_unavailable',
  'connection_failed',
] as const

export type CalendarOAuthErrorReason =
  (typeof CALENDAR_OAUTH_ERROR_REASONS)[number]

export type CalendarOAuthResult =
  | {
      status: 'connected'
      provider: CalendarProvider
    }
  | {
      status: 'error'
      provider: CalendarProvider
      reason: CalendarOAuthErrorReason
    }

interface SearchParamsReader {
  get(name: string): string | null
}

/**
 * Maps provider and internal callback errors to the small set of reasons that
 * may safely cross the redirect boundary into the browser.
 */
export function normalizeCalendarOAuthErrorReason(
  error: string | null | undefined
): CalendarOAuthErrorReason {
  if (
    error === 'access_denied' ||
    error === 'invalid_state' ||
    error === 'provider_mismatch' ||
    error === 'unauthorized' ||
    error === 'profile_mismatch'
  ) {
    return error
  }

  if (error === 'server_error' || error === 'temporarily_unavailable') {
    return 'provider_unavailable'
  }

  return 'connection_failed'
}

/**
 * Builds the allowlisted settings redirect used by calendar OAuth callbacks.
 */
export function buildCalendarOAuthSettingsUrl(
  origin: string,
  result: CalendarOAuthResult
): URL {
  const url = new URL('/settings', origin)
  url.searchParams.set('tab', 'integrations')
  url.searchParams.set('calendar', result.status)
  url.searchParams.set('provider', result.provider)

  if (result.status === 'error') {
    url.searchParams.set('reason', result.reason)
  }

  return url
}

/**
 * Parses new calendar OAuth feedback parameters and the former successful
 * `calendar=connected&detail=<provider>` shape. Legacy error details are
 * deliberately ignored because they may contain raw provider exceptions.
 */
export function parseCalendarOAuthResult(
  searchParams: SearchParamsReader
): CalendarOAuthResult | null {
  const status = searchParams.get('calendar')
  const provider = parseCalendarProvider(searchParams.get('provider') ?? '')

  if (status === 'connected') {
    if (provider) {
      return { status, provider }
    }

    const legacyProvider = parseCalendarProvider(
      searchParams.get('detail') ?? ''
    )

    return legacyProvider ? { status, provider: legacyProvider } : null
  }

  if (status === 'error' && provider) {
    return {
      status,
      provider,
      reason: normalizeCalendarOAuthErrorReason(searchParams.get('reason')),
    }
  }

  return null
}
