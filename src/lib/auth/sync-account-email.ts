import { createAdminBackendClient } from '@/lib/backend/server'
import type {
  BackendCompatClient,
  BackendCompatError,
} from '@/lib/backend/compat/query-client'
import type { BackendCompatAuthPort } from '@/lib/backend/compat/types'

export type AccountEmailSyncErrorCode =
  | 'EMAIL_CONFLICT'
  | 'EMAIL_UPDATE_FAILED'
  | 'EMAIL_PROFILE_SYNC_FAILED'
  | 'EMAIL_PROFILE_SYNC_COMPENSATED'
  | 'EMAIL_RECONCILIATION_REQUIRED'

export type AccountEmailSyncResult =
  | { ok: true; email: string }
  | {
      ok: false
      status: 400 | 409 | 500
      code: AccountEmailSyncErrorCode
      error: string
    }

type AccountEmailSyncClient = Pick<BackendCompatClient, 'auth' | 'from'>

/**
 * Updates Butterbase Auth first, then mirrors the canonical email to the app
 * profile. A failed profile write is compensated by restoring the previous
 * auth email whenever that is possible.
 */
export async function syncAccountEmail(input: {
  userId: string
  profileId: string
  currentEmail: string | null
  nextEmail: string
  client?: AccountEmailSyncClient
  authReader: Pick<BackendCompatAuthPort, 'getUser'>
}): Promise<AccountEmailSyncResult> {
  const client = input.client ?? createAdminBackendClient()
  const currentEmail = input.currentEmail?.trim() || null
  const nextEmail = input.nextEmail.trim().toLowerCase()
  const authChanged =
    !currentEmail || currentEmail.toLowerCase() !== nextEmail.toLowerCase()

  if (authChanged) {
    const authResult = await client.auth.updateUser({
      userId: input.userId,
      email: nextEmail,
    })

    if (authResult.error) {
      if (isEmailConflict(authResult.error)) {
        return {
          ok: false,
          status: 409,
          code: 'EMAIL_CONFLICT',
          error: 'That email address is already in use.',
        }
      }

      return {
        ok: false,
        status: 400,
        code: 'EMAIL_UPDATE_FAILED',
        error: 'Email could not be updated. Please try again.',
      }
    }
  }

  const { error: profileError } = await client
    .from('profiles')
    .update({ email: nextEmail, updated_at: new Date().toISOString() })
    .eq('id', input.profileId)

  if (!profileError) {
    return { ok: true, email: nextEmail }
  }

  if (!authChanged) {
    return {
      ok: false,
      status: 500,
      code: 'EMAIL_PROFILE_SYNC_FAILED',
      error: 'Email could not be synchronized. Please try again.',
    }
  }

  if (currentEmail) {
    const currentAuthResult = await input.authReader.getUser()
    const currentAuthEmail = currentAuthResult.data.user?.email

    if (
      currentAuthResult.error ||
      !currentAuthEmail ||
      currentAuthEmail.trim().toLowerCase() !== nextEmail.toLowerCase()
    ) {
      return {
        ok: false,
        status: 500,
        code: 'EMAIL_RECONCILIATION_REQUIRED',
        error: 'Your sign-in email changed, but the account profile could not be synchronized. Contact support before retrying.',
      }
    }

    const rollbackResult = await client.auth.updateUser({
      userId: input.userId,
      email: currentEmail,
    })

    if (!rollbackResult.error) {
      return {
        ok: false,
        status: 500,
        code: 'EMAIL_PROFILE_SYNC_COMPENSATED',
        error: 'Email was not changed. Your previous sign-in email is still active.',
      }
    }
  }

  return {
    ok: false,
    status: 500,
    code: 'EMAIL_RECONCILIATION_REQUIRED',
    error: 'Your sign-in email changed, but the account profile could not be synchronized. Contact support before retrying.',
  }
}

function isEmailConflict(error: BackendCompatError) {
  if (error.status === 409 || error.code === '23505') return true

  const normalized = `${error.code ?? ''} ${error.message}`.toLowerCase()
  return (
    normalized.includes('already') ||
    normalized.includes('duplicate') ||
    normalized.includes('exists') ||
    normalized.includes('conflict')
  )
}
