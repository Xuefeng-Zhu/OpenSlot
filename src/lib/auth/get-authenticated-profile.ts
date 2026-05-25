import { createServerBackendClient } from '@/lib/backend/server'
import type { BackendCompatClient } from '@/lib/backend/compat/query-client'

export type AuthenticatedProfileResult =
  | { ok: true; profileId: string; userId: string; email: string | null }
  | { ok: false; status: 401 | 404; error: string }

type ProfileLookupClient = Pick<BackendCompatClient, 'auth' | 'from'>

/**
 * Resolves the current Butterbase auth user to the app profile record.
 * Returns typed error states instead of throwing so route handlers can map auth
 * and onboarding failures to stable HTTP responses.
 */
export async function getAuthenticatedProfile(
  backendClient?: ProfileLookupClient
): Promise<AuthenticatedProfileResult> {
  const client = backendClient ?? (await createServerBackendClient())
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser()

  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false, status: 404, error: 'Profile not found' }
  }

  return {
    ok: true,
    profileId: (profile as { id: string }).id,
    userId: user.id,
    email: user.email ?? null,
  }
}
