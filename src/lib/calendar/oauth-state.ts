import { NextRequest } from 'next/server'
import type { CalendarProvider } from './oauth'

export const CALENDAR_OAUTH_STATE_COOKIE = 'openslot_calendar_oauth'
export const CALENDAR_OAUTH_STATE_TTL_SECONDS = 10 * 60

export function calendarCallbackUrl(
  request: NextRequest,
  provider: CalendarProvider
): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  return new URL(`/api/calendar/oauth/${provider}/callback`, origin).toString()
}

export function encodeCalendarOAuthState(value: {
  provider: CalendarProvider
  profileId: string
  state: string
}): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}
