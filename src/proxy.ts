import { NextResponse, type NextRequest } from 'next/server'
import { createBackendRuntime } from '@/lib/backend/runtime'
import {
  BACKEND_ACCESS_TOKEN_COOKIE,
  BACKEND_REFRESH_TOKEN_COOKIE,
  backendSessionCookies,
  type BackendCookieToSet,
  shouldKeepAuthSession,
} from '@/lib/backend/session'

const DASHBOARD_PATH_PREFIXES = [
  '/availability',
  '/bookings',
  '/contacts',
  '/dashboard',
  '/event-types',
  '/onboarding',
  '/profile',
  '/settings',
]

/**
 * Refreshes Butterbase auth cookies and protects dashboard routes.
 * When Butterbase env vars are missing, public pages still render but dashboard
 * requests are sent to login instead of failing during backend client creation.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  if (!process.env.NEXT_PUBLIC_BUTTERBASE_APP_ID) {
    return redirectDashboardToLogin(request) ?? response
  }

  const keepSignedIn = shouldKeepAuthSession(
    (name) => request.cookies.get(name)?.value
  )
  const accessToken = request.cookies.get(BACKEND_ACCESS_TOKEN_COOKIE)?.value
  const refreshToken = request.cookies.get(BACKEND_REFRESH_TOKEN_COOKIE)?.value
  let authenticated = false

  if (accessToken) {
    const backend = createBackendRuntime({ accessToken })
    const user = await backend.auth.getCurrentUser(accessToken)
    authenticated = !user.error && !!user.data
  }

  if (!authenticated && refreshToken) {
    const backend = createBackendRuntime()
    const refreshed = await backend.auth.refreshSession(refreshToken)

    if (!refreshed.error) {
      authenticated = true
      const refreshedCookies = backendSessionCookies(refreshed.data, keepSignedIn)
      response = NextResponse.next({
        request: {
          headers: requestHeadersWithBackendCookies(request, refreshedCookies),
        },
      })
      for (const cookie of refreshedCookies) {
        response.cookies.set(cookie.name, cookie.value, cookie.options)
      }
    }
  }

  if (!authenticated) {
    return redirectDashboardToLogin(request) ?? response
  }

  return response
}

function redirectDashboardToLogin(request: NextRequest) {
  if (!isDashboardPath(request.nextUrl.pathname)) return null

  const returnUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('returnUrl', returnUrl)
  return NextResponse.redirect(loginUrl)
}

function isDashboardPath(pathname: string) {
  return DASHBOARD_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function requestHeadersWithBackendCookies(
  request: NextRequest,
  cookiesToSet: BackendCookieToSet[]
) {
  const headers = new Headers(request.headers)
  headers.set('cookie', mergeCookieHeader(headers.get('cookie'), cookiesToSet))
  return headers
}

function mergeCookieHeader(
  cookieHeader: string | null,
  cookiesToSet: BackendCookieToSet[]
) {
  const cookies = new Map<string, string>()

  for (const cookie of cookieHeader?.split(';') ?? []) {
    const [name, ...valueParts] = cookie.trim().split('=')
    if (!name) continue
    cookies.set(name, valueParts.join('='))
  }

  for (const cookie of cookiesToSet) {
    cookies.set(cookie.name, cookie.value)
  }

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

/**
 * Applies session refresh and dashboard protection to app routes while skipping
 * static assets and optimized image requests.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
