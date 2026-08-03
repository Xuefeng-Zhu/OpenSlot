import { createBackendRuntime } from '@/lib/backend/runtime'
import { currentBackendAccessToken } from '@/lib/backend/server'
import { authError, signOutResponse } from '../_shared'

export const runtime = 'edge'

const REMOTE_SESSION_ABSENT_STATUSES = new Set([401, 404])

/** Invalidates the remote session before clearing OpenSlot's local cookies. */
export async function POST() {
  const accessToken = await currentBackendAccessToken()

  if (accessToken) {
    const backend = createBackendRuntime({ accessToken })
    const result = await backend.auth.signOut(accessToken)

    if (
      result.error &&
      !REMOTE_SESSION_ABSENT_STATUSES.has(result.error.status ?? 0)
    ) {
      return authError('Unable to sign out. Please try again.', 502)
    }
  }

  return signOutResponse()
}
