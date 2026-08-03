import { NextRequest } from 'next/server'
import { base64UrlEncodeString } from '@/lib/security/edge-crypto'
import type { CalendarProvider } from './oauth'

/**
 * HTTP-only cookie used to bind calendar OAuth callbacks to the initiating user.
 */
export const CALENDAR_OAUTH_STATE_COOKIE = 'openslot_calendar_oauth'
/**
 * Short lifetime for OAuth state to limit replay windows.
 */
export const CALENDAR_OAUTH_STATE_TTL_SECONDS = 10 * 60

/**
 * Resolves the canonical public app origin used by calendar OAuth redirects.
 * Production fails closed when the required public URL is absent instead of
 * trusting an incoming Host header.
 */
export function calendarAppOrigin(request: NextRequest): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL

  if (configuredUrl) {
    const parsed = new URL(configuredUrl)
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error('NEXT_PUBLIC_APP_URL must be a public HTTP(S) origin')
    }
    return parsed.origin
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_APP_URL is required for calendar OAuth')
  }

  return new URL(request.url).origin
}

/**
 * Builds the absolute callback URL registered with calendar providers.
 * NEXT_PUBLIC_APP_URL wins when configured so OAuth callbacks use the public
 * deployment origin instead of an internal request host.
 */
export function calendarCallbackUrl(
  request: NextRequest,
  provider: CalendarProvider
): string {
  return new URL(
    `/api/calendar/oauth/${provider}/callback`,
    calendarAppOrigin(request)
  ).toString()
}

/**
 * Encodes the short-lived OAuth state cookie payload.
 * The random state value inside this payload is still validated on callback;
 * base64url is only a transport encoding, not a trust boundary.
 */
export function encodeCalendarOAuthState(value: {
  provider: CalendarProvider
  profileId: string
  state: string
}): string {
  return base64UrlEncodeString(JSON.stringify(value))
}
