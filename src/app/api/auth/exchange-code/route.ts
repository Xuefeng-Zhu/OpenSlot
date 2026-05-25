import { NextRequest } from 'next/server'
import { createBackendCompatClient } from '@/lib/backend/compat/query-client'
import {
  cookiesForBackendSession,
  setResponseCookies,
} from '@/lib/backend/server'
import {
  authError,
  authErrorWithSignOut,
  authJson,
  ensureProfileForAuthUser,
} from '../_shared'
import { readAuthJsonObject } from '../_request'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const body = await readAuthJsonObject(request)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const keepSignedIn = body?.keepSignedIn !== false

  if (!code) {
    return authError('Auth code is required.')
  }

  const client = createBackendCompatClient({ authMode: 'none' })
  const result = await client.auth.exchangeCodeForSession(code)

  if (result.error || !result.data) {
    return authError('Unable to exchange auth code.', result.error?.status ?? 400)
  }

  const profileSync = await ensureProfileForAuthUser({
    authUserId: result.data.user.id,
    email: result.data.user.email,
    displayName:
      typeof result.data.user.user_metadata?.full_name === 'string'
        ? result.data.user.user_metadata.full_name
        : null,
  })

  if (!profileSync.ok) {
    return authErrorWithSignOut(profileSync.error, 500)
  }

  const response = authJson({
    success: true,
    session: {
      access_token: '',
      user: result.data.user,
    },
    user: result.data.user,
  })
  setResponseCookies(
    response,
    cookiesForBackendSession(result.data, keepSignedIn)
  )
  return response
}
