import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database, Tables } from '@/lib/types/database'

export type AuthenticatedAvailabilityProfile =
  | {
      ok: true
      profile: Pick<Tables<'profiles'>, 'id' | 'default_timezone'>
    }
  | {
      ok: false
      error: string
      status: number
    }

export async function getAuthenticatedAvailabilityProfile(
  backendClient: BackendCompatClient<Database>
): Promise<AuthenticatedAvailabilityProfile> {
  const {
    data: { user },
    error: authError,
  } = await backendClient.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: 'Unauthorized', status: 401 }
  }

  const { data: profileData } = await backendClient
    .from('profiles')
    .select('id, default_timezone')
    .eq('auth_user_id', user.id)
    .single()

  const profile = profileData as Pick<
    Tables<'profiles'>,
    'id' | 'default_timezone'
  > | null

  if (!profile) {
    return { ok: false, error: 'Profile not found', status: 401 }
  }

  return { ok: true, profile }
}

export async function loadOwnedSchedule(
  backendClient: BackendCompatClient<Database>,
  scheduleId: string,
  userId: string
): Promise<
  | { ok: true; schedule: Pick<Tables<'schedules'>, 'id' | 'is_default'> }
  | { ok: false; error: string; status: 404 | 500 }
> {
  const { data, error } = await backendClient
    .from('schedules')
    .select('id, is_default')
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return { ok: false, error: 'Schedule not found', status: 404 }
    }

    return { ok: false, error: 'Failed to load schedule', status: 500 }
  }

  return {
    ok: true,
    schedule: data as Pick<Tables<'schedules'>, 'id' | 'is_default'>,
  }
}
