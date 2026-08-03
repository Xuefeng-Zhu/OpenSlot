import { NextRequest } from 'next/server'
import {
  createAdminBackendClient,
  currentBackendAccessToken,
} from '@/lib/backend/server'
import { createBackendCompatClient } from '@/lib/backend/compat/query-client'
import { getAuthenticatedProfile } from '@/lib/auth/get-authenticated-profile'
import { syncAccountEmail } from '@/lib/auth/sync-account-email'
import {
  PASSWORD_COMPLEXITY_ERROR,
  isStrongPassword,
} from '@/lib/validations/password'
import { accountSettingsPatchSchema } from '@/lib/validations/settings'
import { authError, authJson } from '../_shared'
import { readAuthJsonObject } from '../_request'

export const runtime = 'edge'

export async function PATCH(request: NextRequest) {
  const accessToken = await currentBackendAccessToken()
  if (!accessToken) {
    return authError('Authentication required.', 401)
  }

  const body = await readAuthJsonObject(request)
  const email = typeof body?.email === 'string' ? body.email : undefined
  const password = typeof body?.password === 'string' ? body.password : undefined
  const hasEmail = email !== undefined
  const hasPassword = password !== undefined

  if (hasEmail && hasPassword) {
    return authJson(
      {
        success: false,
        code: 'COMBINED_ACCOUNT_UPDATE_NOT_ALLOWED',
        error: 'Update email and password separately.',
      },
      { status: 400 }
    )
  }

  if (!hasEmail && !hasPassword) {
    return authError('No account changes were provided.')
  }

  if (hasPassword && !isStrongPassword(password)) {
    return authError(PASSWORD_COMPLEXITY_ERROR)
  }

  const userClient = createBackendCompatClient({
    accessToken,
    authMode: 'user',
  })
  const auth = await getAuthenticatedProfile(userClient)

  if (!auth.ok) {
    return authError(auth.error, auth.status)
  }

  const adminClient = createAdminBackendClient()

  if (hasEmail) {
    const parsed = accountSettingsPatchSchema.safeParse({
      section: 'account',
      email,
    })

    if (!parsed.success) {
      return authJson(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const result = await syncAccountEmail({
      userId: auth.userId,
      profileId: auth.profileId,
      currentEmail: auth.email,
      nextEmail: parsed.data.email,
      client: adminClient,
      authReader: userClient.auth,
    })

    if (!result.ok) {
      return authJson(
        { success: false, code: result.code, error: result.error },
        { status: result.status }
      )
    }

    return authJson({ success: true, user: null, email: result.email })
  }

  const result = await adminClient.auth.updateUser({
    userId: auth.userId,
    password,
  })
  if (result.error) {
    return authError(result.error.message, result.error.status ?? 400)
  }

  return authJson({ success: true, user: result.data?.user ?? null })
}
