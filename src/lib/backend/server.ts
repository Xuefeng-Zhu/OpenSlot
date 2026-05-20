import { cookies } from 'next/headers'
import { createButterbaseBackend } from './butterbase/adapter'
import { resolveButterbaseConfig } from './butterbase/config'
import {
  createBackendCompatClient,
  type BackendCompatClient,
} from './compat/query-client'
import {
  BACKEND_ACCESS_TOKEN_COOKIE,
  BACKEND_REFRESH_TOKEN_COOKIE,
  backendSessionCookies,
  clearBackendSessionCookies,
  shouldKeepAuthSession,
  type BackendCookieToSet,
} from './session'

export async function createServerBackendClient() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(BACKEND_ACCESS_TOKEN_COOKIE)?.value

  return createBackendCompatClient({
    accessToken,
    authMode: accessToken ? 'user' : 'none',
  })
}

export function createAdminBackendClient(): BackendCompatClient {
  return createBackendCompatClient({ authMode: 'service' })
}

export async function createRequestBackend() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(BACKEND_ACCESS_TOKEN_COOKIE)?.value

  return createButterbaseBackend({
    ...resolveButterbaseConfig(),
    accessToken,
  })
}

export async function currentBackendAccessToken() {
  const cookieStore = await cookies()
  return cookieStore.get(BACKEND_ACCESS_TOKEN_COOKIE)?.value
}

export async function currentBackendRefreshToken() {
  const cookieStore = await cookies()
  return cookieStore.get(BACKEND_REFRESH_TOKEN_COOKIE)?.value
}

export async function currentBackendKeepSignedIn() {
  const cookieStore = await cookies()
  return shouldKeepAuthSession((name) => cookieStore.get(name)?.value)
}

export function cookiesForBackendSession(
  session: Parameters<typeof backendSessionCookies>[0],
  keepSignedIn: boolean
) {
  return backendSessionCookies(session, keepSignedIn)
}

export function cookiesForBackendSignOut() {
  return clearBackendSessionCookies()
}

export function setResponseCookies(
  response: {
    cookies: {
      set: (
        name: string,
        value: string,
        options: BackendCookieToSet['options']
      ) => void
    }
  },
  cookiesToSet: BackendCookieToSet[]
) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
}
