import { NextRequest } from 'next/server'
import { createBackendRuntime } from '@/lib/backend/runtime'
import {
  authError,
  authErrorWithSignOut,
  ensureProfileForAuthUser,
  sessionResponse,
} from '../_shared'
import { readAuthJsonObject } from '../_request'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const body = await readAuthJsonObject(request)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const keepSignedIn = body?.keepSignedIn !== false

  if (!email || !password) {
    return authError('Email and password are required.')
  }

  const backend = createBackendRuntime()
  const result = await backend.auth.signInWithPassword({ email, password })

  if (result.error) {
    return authError('We could not sign you in.', result.error.status ?? 401)
  }

  const profileSync = await ensureProfileForAuthUser({
    authUserId: result.data.user.id,
    email: result.data.user.email,
    displayName: result.data.user.displayName,
  })

  if (!profileSync.ok) {
    return authErrorWithSignOut(profileSync.error, 500)
  }

  return sessionResponse(result.data, keepSignedIn)
}
