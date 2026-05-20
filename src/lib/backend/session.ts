import type { BackendSession } from './ports'
import type { BackendCompatSession } from './compat/query-client'

export const BACKEND_ACCESS_TOKEN_COOKIE = 'openslot_backend_access_token'
export const BACKEND_REFRESH_TOKEN_COOKIE = 'openslot_backend_refresh_token'
export const AUTH_SESSION_PERSISTENCE_COOKIE =
  'openslot_auth_session_persistence'

export const PERSISTENT_SESSION_MAX_AGE = 400 * 24 * 60 * 60
export const ACCESS_TOKEN_FALLBACK_MAX_AGE = 60 * 60

export type BackendCookieOptions = {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: boolean | 'lax' | 'strict' | 'none'
  path?: string
  domain?: string
  maxAge?: number
  expires?: Date
}

export type BackendCookieToSet = {
  name: string
  value: string
  options: BackendCookieOptions
}

type PortableBackendSession = BackendCompatSession | BackendSession

const SESSION_COOKIE_VALUE = 'session'
const PERSISTENCE_COOKIE_VALUE = 'persistent'

export function shouldKeepAuthSession(
  getCookieValue: (name: string) => string | null | undefined
) {
  return getCookieValue(AUTH_SESSION_PERSISTENCE_COOKIE) !== SESSION_COOKIE_VALUE
}

export function authSessionPersistenceCookie(keepSignedIn: boolean) {
  return {
    name: AUTH_SESSION_PERSISTENCE_COOKIE,
    value: keepSignedIn ? PERSISTENCE_COOKIE_VALUE : SESSION_COOKIE_VALUE,
    options: {
      path: '/',
      sameSite: 'lax',
      ...(keepSignedIn ? { maxAge: PERSISTENT_SESSION_MAX_AGE } : {}),
    },
  } satisfies BackendCookieToSet
}

export function backendSessionCookies(
  session: PortableBackendSession,
  keepSignedIn: boolean
) {
  const baseOptions = sessionCookieOptions(keepSignedIn)
  const compatSession = session as Partial<BackendCompatSession>
  const portSession = session as Partial<BackendSession>
  const accessToken = compatSession.access_token ?? portSession.accessToken ?? ''
  const refreshToken = compatSession.refresh_token ?? portSession.refreshToken
  const expiresIn = compatSession.expires_in ?? portSession.expiresIn
  const accessTokenMaxAge = Math.max(
    60,
    Math.min(expiresIn ?? ACCESS_TOKEN_FALLBACK_MAX_AGE, PERSISTENT_SESSION_MAX_AGE)
  )

  const cookies: BackendCookieToSet[] = [
    {
      name: BACKEND_ACCESS_TOKEN_COOKIE,
      value: accessToken,
      options: {
        ...baseOptions,
        maxAge: keepSignedIn ? accessTokenMaxAge : undefined,
      },
    },
  ]

  if (refreshToken) {
    cookies.push({
      name: BACKEND_REFRESH_TOKEN_COOKIE,
      value: refreshToken,
      options: {
        ...baseOptions,
        maxAge: keepSignedIn ? PERSISTENT_SESSION_MAX_AGE : undefined,
      },
    })
  }

  cookies.push(authSessionPersistenceCookie(keepSignedIn))

  return cookies
}

export function clearBackendSessionCookies() {
  return [
    BACKEND_ACCESS_TOKEN_COOKIE,
    BACKEND_REFRESH_TOKEN_COOKIE,
    AUTH_SESSION_PERSISTENCE_COOKIE,
  ].map((name) => ({
    name,
    value: '',
    options: {
      path: '/',
      httpOnly: name !== AUTH_SESSION_PERSISTENCE_COOKIE,
      sameSite: 'lax',
      maxAge: 0,
    },
  })) satisfies BackendCookieToSet[]
}

function sessionCookieOptions(keepSignedIn: boolean): BackendCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(keepSignedIn ? { maxAge: PERSISTENT_SESSION_MAX_AGE } : {}),
  }
}
