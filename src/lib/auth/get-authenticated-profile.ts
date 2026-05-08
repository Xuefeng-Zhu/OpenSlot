import { createServerSupabaseClient } from '@/lib/supabase/server'

export type AuthenticatedProfileResult =
  | { ok: true; profileId: string; userId: string; email: string | null }
  | { ok: false; status: 401 | 404; error: string }

export async function getAuthenticatedProfile(): Promise<AuthenticatedProfileResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const { data: profile, error: profileError } = await supabase
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
