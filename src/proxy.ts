import { NextResponse, type NextRequest } from 'next/server'
import { createBackendRuntime } from '@/lib/backend/runtime'
import {
  BACKEND_ACCESS_TOKEN_COOKIE,
  BACKEND_REFRESH_TOKEN_COOKIE,
  backendSessionCookies,
  shouldKeepAuthSession,
} from '@/lib/backend/session'

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
      response = NextResponse.next({
        request: {
          headers: request.headers,
        },
      })
      for (const cookie of backendSessionCookies(refreshed.data, keepSignedIn)) {
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
  if (!request.nextUrl.pathname.startsWith('/dashboard')) return null

  const returnUrl = encodeURIComponent(request.nextUrl.pathname)
  const loginUrl = new URL(`/login?returnUrl=${returnUrl}`, request.url)
  return NextResponse.redirect(loginUrl)
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
