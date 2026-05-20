import { createBackendCompatClient } from '@/lib/backend/compat/query-client'
import { currentBackendAccessToken } from '@/lib/backend/server'
import { authJson } from '../_shared'

export const runtime = 'edge'

export async function GET() {
  const accessToken = await currentBackendAccessToken()
  if (!accessToken) {
    return authJson({ session: null, user: null })
  }

  const client = createBackendCompatClient({ accessToken, authMode: 'user' })
  const { data, error } = await client.auth.getUser()

  if (error || !data.user) {
    return authJson({ session: null, user: null })
  }

  return authJson({
    session: {
      access_token: '',
      user: data.user,
    },
    user: data.user,
  })
}
