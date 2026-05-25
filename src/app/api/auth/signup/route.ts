import { NextRequest } from 'next/server'
import { createBackendRuntime } from '@/lib/backend/runtime'
import {
  authError,
  authJson,
  ensureProfileForAuthUser,
  sessionResponse,
} from '../_shared'
import { readAuthJsonObject } from '../_request'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const body = await readAuthJsonObject(request)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const displayName =
    typeof body?.displayName === 'string' ? body.displayName.trim() : ''
  const keepSignedIn = body?.keepSignedIn !== false

  if (!email || !password) {
    return authError('Email and password are required.')
  }

  const backend = createBackendRuntime()
  const signup = await backend.auth.signUp({ email, password, displayName })

  if (signup.error) {
    return authError('Unable to create account.', signup.error.status ?? 400)
  }

  const profileSync = await ensureProfileForAuthUser({
    authUserId: signup.data.id,
    email: signup.data.email,
    displayName,
  })

  if (!profileSync.ok) {
    return authError(profileSync.error, 500)
  }

  const signin = await backend.auth.signInWithPassword({ email, password })
  if (signin.error) {
    return authJson(
      {
        success: true,
        requiresLogin: true,
        user: signup.data,
      },
      { status: 202 }
    )
  }

  return sessionResponse(signin.data, keepSignedIn, { status: 201 })
}
