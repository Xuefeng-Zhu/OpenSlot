import { NextRequest } from 'next/server'
import {
  createAdminBackendClient,
  currentBackendAccessToken,
} from '@/lib/backend/server'
import { createBackendCompatClient } from '@/lib/backend/compat/query-client'
import { authError, authJson } from '../_shared'

export const runtime = 'edge'

export async function PATCH(request: NextRequest) {
  const accessToken = await currentBackendAccessToken()
  if (!accessToken) {
    return authError('Authentication required.', 401)
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : undefined
  const password = typeof body?.password === 'string' ? body.password : undefined

  if (!email && !password) {
    return authError('No account changes were provided.')
  }

  const userClient = createBackendCompatClient({
    accessToken,
    authMode: 'user',
  })
  const { data: userResult } = await userClient.auth.getUser()
  const user = userResult.user

  if (!user) {
    return authError('Authentication required.', 401)
  }

  const adminClient = createAdminBackendClient()
  const result = await adminClient.auth.updateUser({
    userId: user.id,
    email,
    password,
  })
  if (result.error) {
    return authError(result.error.message, result.error.status ?? 400)
  }

  if (email) {
    await adminClient
      .from('profiles')
      .update({ email, updated_at: new Date().toISOString() })
      .eq('auth_user_id', user.id)
  }

  return authJson({ success: true, user: result.data?.user ?? user })
}
