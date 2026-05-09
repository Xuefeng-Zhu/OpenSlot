/**
 * Calendar providers supported by OpenSlot OAuth and sync flows.
 */
export const calendarProviders = ['google', 'microsoft'] as const

export type CalendarProvider = (typeof calendarProviders)[number]

export interface CalendarOAuthConfig {
  provider: CalendarProvider
  clientId: string
  clientSecret: string
  authorizationUrl: string
  tokenUrl: string
  scopes: string[]
  authorizationParams?: Record<string, string>
}

export interface CalendarOAuthTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null
  scopes: string[]
  tokenType: string | null
}

export interface CalendarProviderIdentity {
  accountEmail: string
  externalAccountId: string | null
  displayName: string | null
}

interface OAuthTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

interface GoogleIdentityResponse {
  sub?: string
  email?: string
  name?: string
}

interface MicrosoftIdentityResponse {
  id?: string
  mail?: string | null
  userPrincipalName?: string | null
  displayName?: string | null
}

/**
 * Parses a route or query-string provider value into a supported calendar provider.
 * Returns null instead of throwing so API routes can turn unknown providers into
 * controlled 404/400 responses.
 */
export function parseCalendarProvider(value: string): CalendarProvider | null {
  return calendarProviders.includes(value as CalendarProvider)
    ? (value as CalendarProvider)
    : null
}

/**
 * Builds the OAuth endpoint, credential, and scope configuration for a provider.
 * Reads secrets from the server environment and throws if a required client
 * credential is missing.
 */
export function getCalendarOAuthConfig(
  provider: CalendarProvider
): CalendarOAuthConfig {
  if (provider === 'google') {
    return {
      provider,
      clientId: requiredEnv('GOOGLE_CALENDAR_CLIENT_ID'),
      clientSecret: requiredEnv('GOOGLE_CALENDAR_CLIENT_SECRET'),
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      authorizationParams: {
        access_type: 'offline',
        include_granted_scopes: 'true',
        prompt: 'consent',
      },
    }
  }

  const tenant = process.env.MICROSOFT_CALENDAR_TENANT || 'common'

  return {
    provider,
    clientId: requiredEnv('MICROSOFT_CALENDAR_CLIENT_ID'),
    clientSecret: requiredEnv('MICROSOFT_CALENDAR_CLIENT_SECRET'),
    authorizationUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scopes: [
      'openid',
      'email',
      'profile',
      'offline_access',
      'User.Read',
      'Calendars.ReadWrite',
    ],
    authorizationParams: {
      prompt: 'select_account',
    },
  }
}

/**
 * Builds the provider authorization URL for the calendar connection flow.
 * The caller supplies the redirect URI and opaque state value so routes can bind
 * the callback to the current profile/session.
 */
export function buildCalendarAuthorizationUrl({
  provider,
  redirectUri,
  state,
}: {
  provider: CalendarProvider
  redirectUri: string
  state: string
}): URL {
  const config = getCalendarOAuthConfig(provider)
  const url = new URL(config.authorizationUrl)

  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', config.scopes.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('response_mode', 'query')

  for (const [key, value] of Object.entries(config.authorizationParams ?? {})) {
    url.searchParams.set(key, value)
  }

  return url
}

/**
 * Exchanges a provider authorization code for OAuth tokens.
 * Normalizes Google and Microsoft token responses into the storage shape used by
 * provider connections.
 */
export async function exchangeCalendarAuthorizationCode({
  provider,
  code,
  redirectUri,
  fetchImpl = fetch,
}: {
  provider: CalendarProvider
  code: string
  redirectUri: string
  fetchImpl?: typeof fetch
}): Promise<CalendarOAuthTokens> {
  const config = getCalendarOAuthConfig(provider)
  const response = await fetchImpl(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = (await response.json().catch(() => ({}))) as OAuthTokenResponse

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        `Calendar token exchange failed with HTTP ${response.status}`
    )
  }

  return normalizeTokenResponse(data, config.scopes)
}

/**
 * Refreshes an access token using a stored provider refresh token.
 * Some providers rotate refresh tokens while others omit them, so callers must
 * preserve the previous refresh token when the returned value is null.
 */
export async function refreshCalendarAccessToken({
  provider,
  refreshToken,
  fetchImpl = fetch,
}: {
  provider: CalendarProvider
  refreshToken: string
  fetchImpl?: typeof fetch
}): Promise<CalendarOAuthTokens> {
  const config = getCalendarOAuthConfig(provider)
  const response = await fetchImpl(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: config.scopes.join(' '),
    }),
  })
  const data = (await response.json().catch(() => ({}))) as OAuthTokenResponse

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        `Calendar token refresh failed with HTTP ${response.status}`
    )
  }

  return normalizeTokenResponse(data, config.scopes)
}

/**
 * Loads the connected calendar account identity from the provider.
 * Returns only stable account metadata needed to show the connection and detect
 * which external account was linked.
 */
export async function fetchCalendarProviderIdentity({
  provider,
  accessToken,
  fetchImpl = fetch,
}: {
  provider: CalendarProvider
  accessToken: string
  fetchImpl?: typeof fetch
}): Promise<CalendarProviderIdentity> {
  if (provider === 'google') {
    const data = await providerJson<GoogleIdentityResponse>(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      accessToken,
      fetchImpl
    )

    if (!data.email) {
      throw new Error('Google account email was not returned')
    }

    return {
      accountEmail: data.email,
      externalAccountId: data.sub ?? null,
      displayName: data.name ?? null,
    }
  }

  const data = await providerJson<MicrosoftIdentityResponse>(
    'https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,displayName',
    accessToken,
    fetchImpl
  )
  const accountEmail = data.mail ?? data.userPrincipalName

  if (!accountEmail) {
    throw new Error('Microsoft account email was not returned')
  }

  return {
    accountEmail,
    externalAccountId: data.id ?? null,
    displayName: data.displayName ?? null,
  }
}

function normalizeTokenResponse(
  data: OAuthTokenResponse,
  fallbackScopes: string[]
): CalendarOAuthTokens {
  return {
    accessToken: data.access_token ?? '',
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
    scopes: data.scope ? data.scope.split(' ') : fallbackScopes,
    tokenType: data.token_type ?? null,
  }
}

async function providerJson<T>(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch
): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Provider request failed with HTTP ${response.status}`)
  }

  return data
}

function requiredEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}
