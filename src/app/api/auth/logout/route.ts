import { createBackendRuntime } from '@/lib/backend/runtime'
import { currentBackendAccessToken } from '@/lib/backend/server'
import { signOutResponse } from '../_shared'

export async function POST() {
  const accessToken = await currentBackendAccessToken()

  if (accessToken) {
    const backend = createBackendRuntime({ accessToken })
    await backend.auth.signOut(accessToken)
  }

  return signOutResponse()
}
