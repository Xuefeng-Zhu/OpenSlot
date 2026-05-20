import { NextRequest } from 'next/server'
import { createBackendRuntime } from '@/lib/backend/runtime'
import { authError, authJson } from '../_shared'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''

  if (!email) {
    return authError('Email is required.')
  }

  const backend = createBackendRuntime()
  const result = await backend.auth.requestPasswordReset({ email })

  if (result.error) {
    return authError('Unable to send reset code.', result.error.status ?? 400)
  }

  return authJson({ success: true })
}
