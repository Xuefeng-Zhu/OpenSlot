import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  applyAuthSessionPersistence,
  shouldKeepAuthSession,
} from '@/lib/supabase/auth-cookie-persistence'

/**
 * Refreshes Supabase auth cookies and protects dashboard routes at the edge.
 * When Supabase env vars are missing, public pages still render but dashboard
 * requests are sent to login instead of failing during client creation.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    return response
  }

  const keepSignedIn = shouldKeepAuthSession(
    (name) => request.cookies.get(name)?.value
  )

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: {
            name: string
            value: string
            options: CookieOptions
          }[]
        ) {
          const authCookies = applyAuthSessionPersistence(
            cookiesToSet,
            keepSignedIn
          )

          authCookies.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          authCookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the auth session to keep it alive
  const { data: { user } } = await supabase.auth.getUser()

  // Protect /dashboard routes - redirect unauthenticated users to login
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const returnUrl = encodeURIComponent(request.nextUrl.pathname)
    const loginUrl = new URL(`/login?returnUrl=${returnUrl}`, request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

/**
 * Applies session refresh and dashboard protection to app routes while skipping
 * static assets and optimized image requests.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
