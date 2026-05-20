import type { BackendCookieOptions as CookieOptions } from '@/lib/backend/session'

export const AUTH_SESSION_PERSISTENCE_COOKIE =
  'openslot_auth_session_persistence'

type CookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

type BrowserCookieOptions = CookieOptions & {
  sameSite?: boolean | 'lax' | 'strict' | 'none'
}

const PERSISTENCE_COOKIE_VALUE = 'persistent'
const SESSION_COOKIE_VALUE = 'session'
const PERSISTENT_COOKIE_MAX_AGE = 400 * 24 * 60 * 60

/**
 * Reads the host preference that controls whether backend auth cookies should
 * be browser-session cookies or long-lived refresh cookies.
 */
export function shouldKeepAuthSession(
  getCookieValue: (name: string) => string | null | undefined
) {
  return getCookieValue(AUTH_SESSION_PERSISTENCE_COOKIE) !== SESSION_COOKIE_VALUE
}

/**
 * Removes long-lived expiration metadata from cookie writes when a user chooses
 * a browser-session login. Deletion writes keep `maxAge: 0` intact.
 */
export function applyAuthSessionPersistence<TCookie extends CookieToSet>(
  cookiesToSet: TCookie[],
  keepSignedIn: boolean
) {
  if (keepSignedIn) return cookiesToSet

  return cookiesToSet.map((cookie) => {
    const options = { ...cookie.options }
    const maxAge = options.maxAge

    if (maxAge === undefined || maxAge > 0) {
      delete options.maxAge
      delete options.expires
    }

    return {
      ...cookie,
      options,
    }
  })
}

export function getBrowserCookies() {
  if (typeof document === 'undefined' || !document.cookie) return []

  return document.cookie.split(';').flatMap((cookie) => {
    const trimmedCookie = cookie.trim()
    if (!trimmedCookie) return []

    const [name, ...valueParts] = trimmedCookie.split('=')
    return [{ name, value: valueParts.join('=') }]
  })
}

export function setBrowserAuthSessionPersistence(keepSignedIn: boolean) {
  if (typeof document === 'undefined') return

  document.cookie = serializeBrowserCookie(
    AUTH_SESSION_PERSISTENCE_COOKIE,
    keepSignedIn ? PERSISTENCE_COOKIE_VALUE : SESSION_COOKIE_VALUE,
    {
      path: '/',
      sameSite: 'lax',
      ...(keepSignedIn ? { maxAge: PERSISTENT_COOKIE_MAX_AGE } : {}),
    }
  )
}

export function setBrowserCookies(
  cookiesToSet: CookieToSet[],
  keepSignedIn: boolean
) {
  applyAuthSessionPersistence(cookiesToSet, keepSignedIn).forEach(
    ({ name, value, options }) => {
      document.cookie = serializeBrowserCookie(name, value, options)
    }
  )
}

function serializeBrowserCookie(
  name: string,
  value: string,
  options: BrowserCookieOptions
) {
  const parts = [`${name}=${value}`]

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`)
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`)
  }

  if (options.path) {
    parts.push(`Path=${options.path}`)
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }

  if (options.sameSite) {
    const sameSite =
      options.sameSite === true ? 'Strict' : capitalizeSameSite(options.sameSite)
    parts.push(`SameSite=${sameSite}`)
  }

  if (options.secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

function capitalizeSameSite(sameSite: 'lax' | 'strict' | 'none') {
  return sameSite.charAt(0).toUpperCase() + sameSite.slice(1)
}
