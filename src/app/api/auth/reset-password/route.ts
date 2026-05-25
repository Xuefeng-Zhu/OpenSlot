import { NextRequest } from 'next/server'
import { createBackendRuntime } from '@/lib/backend/runtime'
import {
  PASSWORD_COMPLEXITY_ERROR,
  isStrongPassword,
} from '@/lib/validations/password'
import { authError, authJson } from '../_shared'
import { readAuthJsonObject } from '../_request'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const body = await readAuthJsonObject(request)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const newPassword =
    typeof body?.password === 'string' ? body.password : body?.newPassword

  if (!email || !code || typeof newPassword !== 'string') {
    return authError('Email, reset code, and new password are required.')
  }

  if (!isStrongPassword(newPassword)) {
    return authError(PASSWORD_COMPLEXITY_ERROR)
  }

  const backend = createBackendRuntime()
  const result = await backend.auth.resetPassword({
    email,
    code,
    newPassword,
  })

  if (result.error) {
    return authError('Unable to update password.', result.error.status ?? 400)
  }

  return authJson({ success: true })
}
