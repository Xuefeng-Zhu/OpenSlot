import { NextRequest } from 'next/server'
import { currentBackendAccessToken } from '@/lib/backend/server'
import { createBackendCompatClient } from '@/lib/backend/compat/query-client'
import {
  ACCOUNT_COMBINED_UPDATE_NOT_ALLOWED,
  ACCOUNT_EMAIL_UPDATE_UNAVAILABLE,
  ACCOUNT_PASSWORD_RESET_REQUIRED,
} from '@/lib/auth/account-mutation-policy'
import { getAuthenticatedProfile } from '@/lib/auth/get-authenticated-profile'
import { authError, authJson } from '../_shared'
import { readAuthJsonObject } from '../_request'

export const runtime = 'edge'

export async function PATCH(request: NextRequest) {
  const accessToken = await currentBackendAccessToken()
  if (!accessToken) {
    return authError('Authentication required.', 401)
  }

  const body = await readAuthJsonObject(request)
  const hasEmail = body !== null && 'email' in body
  const hasPassword = body !== null && 'password' in body

  if (hasEmail && hasPassword) {
    return authJson(
      {
        success: false,
        code: ACCOUNT_COMBINED_UPDATE_NOT_ALLOWED.code,
        error: ACCOUNT_COMBINED_UPDATE_NOT_ALLOWED.message,
        details: ACCOUNT_COMBINED_UPDATE_NOT_ALLOWED.details,
      },
      { status: ACCOUNT_COMBINED_UPDATE_NOT_ALLOWED.status }
    )
  }

  if (!hasEmail && !hasPassword) {
    return authError('No account changes were provided.')
  }

  const userClient = createBackendCompatClient({
    accessToken,
    authMode: 'user',
  })
  const auth = await getAuthenticatedProfile(userClient)

  if (!auth.ok) {
    return authError(auth.error, auth.status)
  }

  if (hasEmail) {
    return authJson(
      {
        success: false,
        code: ACCOUNT_EMAIL_UPDATE_UNAVAILABLE.code,
        error: ACCOUNT_EMAIL_UPDATE_UNAVAILABLE.message,
      },
      { status: ACCOUNT_EMAIL_UPDATE_UNAVAILABLE.status }
    )
  }

  return authJson(
    {
      success: false,
      code: ACCOUNT_PASSWORD_RESET_REQUIRED.code,
      error: ACCOUNT_PASSWORD_RESET_REQUIRED.message,
      details: ACCOUNT_PASSWORD_RESET_REQUIRED.details,
    },
    { status: ACCOUNT_PASSWORD_RESET_REQUIRED.status }
  )
}
