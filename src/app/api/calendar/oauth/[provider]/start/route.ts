import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/auth/get-authenticated-profile'
import {
  buildCalendarAuthorizationUrl,
  parseCalendarProvider,
} from '@/lib/calendar/oauth'
import {
  CALENDAR_OAUTH_STATE_COOKIE,
  CALENDAR_OAUTH_STATE_TTL_SECONDS,
  calendarCallbackUrl,
  encodeCalendarOAuthState,
} from '@/lib/calendar/oauth-state'
import { randomBase64Url } from '@/lib/security/edge-crypto'

interface CalendarOAuthRouteContext {
  params: Promise<{ provider: string }>
}

/**
 * Starts the calendar OAuth flow for the signed-in host.
 * Stores provider, profile, and random state in an HTTP-only cookie so the
 * callback can reject cross-profile or replayed authorization responses.
 */
export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: CalendarOAuthRouteContext
) {
  try {
    const { provider: providerParam } = await params
    const provider = parseCalendarProvider(providerParam)

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Unsupported calendar provider' },
        { status: 404 }
      )
    }

    const auth = await getAuthenticatedProfile()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const state = randomBase64Url(24)
    const redirectUri = calendarCallbackUrl(request, provider)
    const authorizationUrl = buildCalendarAuthorizationUrl({
      provider,
      redirectUri,
      state,
    })
    const response = NextResponse.redirect(authorizationUrl)

    response.cookies.set(
      CALENDAR_OAUTH_STATE_COOKIE,
      encodeCalendarOAuthState({
        provider,
        profileId: auth.profileId,
        state,
      }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: CALENDAR_OAUTH_STATE_TTL_SECONDS,
        path: '/',
      }
    )

    return response
  } catch (error) {
    console.error('Error in GET /api/calendar/oauth/[provider]/start:', error)
    return NextResponse.json(
      { success: false, error: 'Calendar connection could not be started' },
      { status: 500 }
    )
  }
}
