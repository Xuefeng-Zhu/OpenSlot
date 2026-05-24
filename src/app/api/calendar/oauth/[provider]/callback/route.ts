import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/auth/get-authenticated-profile'
import { createAdminBackendClient } from '@/lib/backend/server'
import {
  exchangeCalendarAuthorizationCode,
  fetchCalendarProviderIdentity,
  parseCalendarProvider,
  type CalendarProvider,
} from '@/lib/calendar/oauth'
import { syncCalendarsForConnection } from '@/lib/calendar/provider-sync'
import { ensureCalendarWatchesForConnection } from '@/lib/calendar/watches'
import { base64UrlDecodeToString } from '@/lib/security/edge-crypto'
import { encryptToken } from '@/lib/security/token-encryption'
import {
  CALENDAR_OAUTH_STATE_COOKIE,
  calendarCallbackUrl,
} from '@/lib/calendar/oauth-state'
import type { Json, Tables } from '@/lib/types/database'

interface CalendarOAuthRouteContext {
  params: Promise<{ provider: string }>
}

interface OAuthStateCookie {
  provider: CalendarProvider
  profileId: string
  state: string
}

type ProviderConnectionRow = Tables<'provider_connections'>

/**
 * Handles the OAuth provider callback for a calendar connection.
 * Validates the signed-in profile against the short-lived state cookie, stores
 * encrypted provider tokens, and immediately syncs calendars before redirecting
 * back to settings with a compact status marker.
 */
export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: CalendarOAuthRouteContext
) {
  const { provider: providerParam } = await params
  const provider = parseCalendarProvider(providerParam)

  if (!provider) {
    return NextResponse.json(
      { success: false, error: 'Unsupported calendar provider' },
      { status: 404 }
    )
  }

  try {
    const url = new URL(request.url)
    const error = url.searchParams.get('error')

    if (error) {
      return redirectToSettings(request, 'error', error)
    }

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const storedState = parseStateCookie(
      request.cookies.get(CALENDAR_OAUTH_STATE_COOKIE)?.value
    )

    if (!code || !state || !storedState || storedState.state !== state) {
      return redirectToSettings(request, 'error', 'invalid_state')
    }

    if (storedState.provider !== provider) {
      return redirectToSettings(request, 'error', 'provider_mismatch')
    }

    const auth = await getAuthenticatedProfile()

    if (!auth.ok) {
      return redirectToSettings(request, 'error', 'unauthorized')
    }

    if (auth.profileId !== storedState.profileId) {
      return redirectToSettings(request, 'error', 'profile_mismatch')
    }

    const redirectUri = calendarCallbackUrl(request, provider)
    const tokens = await exchangeCalendarAuthorizationCode({
      provider,
      code,
      redirectUri,
    })
    const identity = await fetchCalendarProviderIdentity({
      provider,
      accessToken: tokens.accessToken,
    })
    const adminClient = createAdminBackendClient()
    const connection = await upsertProviderConnection({
      adminClient,
      provider,
      profileId: auth.profileId,
      accountEmail: identity.accountEmail,
      tokens,
      metadata: {
        externalAccountId: identity.externalAccountId,
        displayName: identity.displayName,
        tokenType: tokens.tokenType,
      },
    })

    await syncCalendarsForConnection(adminClient, connection.id)
    await ensureCalendarWatchesForConnection(adminClient, connection.id)

    return redirectToSettings(request, 'connected', provider)
  } catch (error) {
    console.error('Error in GET /api/calendar/oauth/[provider]/callback:', error)
    return redirectToSettings(request, 'error', errorMessage(error))
  }
}

/**
 * Creates or refreshes a calendar provider connection for one external account.
 * Providers may omit refresh_token on subsequent grants, so existing refresh
 * credentials are preserved unless a new token is explicitly returned.
 */
async function upsertProviderConnection({
  adminClient,
  provider,
  profileId,
  accountEmail,
  tokens,
  metadata,
}: {
  adminClient: ReturnType<typeof createAdminBackendClient>
  provider: CalendarProvider
  profileId: string
  accountEmail: string
  tokens: {
    accessToken: string
    refreshToken: string | null
    expiresAt: string | null
    scopes: string[]
  }
  metadata: Json
}): Promise<ProviderConnectionRow> {
  const { data: existing } = await adminClient
    .from('provider_connections')
    .select('*')
    .eq('profile_id', profileId)
    .eq('provider', provider)
    .eq('account_email', accountEmail)
    .maybeSingle()

  const now = new Date().toISOString()
  const payload = {
    profile_id: profileId,
    provider,
    account_email: accountEmail,
    scopes: tokens.scopes,
    access_token_encrypted: await encryptToken(tokens.accessToken),
    refresh_token_encrypted: tokens.refreshToken
      ? await encryptToken(tokens.refreshToken)
      : (existing as ProviderConnectionRow | null)?.refresh_token_encrypted ?? null,
    token_expires_at: tokens.expiresAt,
    status: 'active',
    metadata,
    last_error: null,
    updated_at: now,
  }

  if (existing) {
    const { data, error } = await adminClient
      .from('provider_connections')
      .update(payload)
      .eq('id', (existing as ProviderConnectionRow).id)
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(`Failed to update calendar connection: ${error?.message}`)
    }

    return data as ProviderConnectionRow
  }

  const { data, error } = await adminClient
    .from('provider_connections')
    .insert(payload)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create calendar connection: ${error?.message}`)
  }

  return data as ProviderConnectionRow
}

/**
 * Redirects back to settings and clears the one-time OAuth state cookie.
 * The detail value is bounded before it reaches the URL so provider errors do
 * not create oversized redirects.
 */
function redirectToSettings(
  request: NextRequest,
  calendar: string,
  detail: string
): NextResponse {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const url = new URL('/settings', origin)
  url.searchParams.set('calendar', calendar)
  url.searchParams.set('detail', detail.slice(0, 120))
  const response = NextResponse.redirect(url)
  response.cookies.set(CALENDAR_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  })
  return response
}

/**
 * Decodes and validates the OAuth state cookie payload.
 * Invalid JSON, unsupported providers, or incomplete state values all collapse
 * to null so the callback can use one invalid-state response path.
 */
function parseStateCookie(value?: string): OAuthStateCookie | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(
      base64UrlDecodeToString(value)
    ) as OAuthStateCookie

    if (
      parseCalendarProvider(parsed.provider) &&
      typeof parsed.profileId === 'string' &&
      typeof parsed.state === 'string'
    ) {
      return parsed
    }
  } catch {
    return null
  }

  return null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error'
}
