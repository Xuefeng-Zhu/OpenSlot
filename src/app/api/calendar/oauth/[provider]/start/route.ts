import { randomBytes } from 'node:crypto'
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

interface CalendarOAuthRouteContext {
  params: Promise<{ provider: string }>
}

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

    const state = randomBytes(24).toString('base64url')
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
      { success: false, error: errorMessage(error) },
      { status: 500 }
    )
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error'
}
