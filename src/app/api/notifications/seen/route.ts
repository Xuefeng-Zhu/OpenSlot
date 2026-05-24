import { NextResponse } from 'next/server'
import { createAdminBackendClient, createServerBackendClient } from '@/lib/backend/server'

async function getAuthenticatedProfile() {
  const backendClient = await createServerBackendClient()
  const {
    data: { user },
    error: authError,
  } = await backendClient.auth.getUser()

  if (authError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: 'Unauthorized',
    }
  }

  const { data: profile, error: profileError } = await backendClient
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (profileError || !profile) {
    return {
      ok: false as const,
      status: 404,
      error: 'Profile not found',
    }
  }

  return {
    ok: true as const,
    profile: profile as { id: string },
  }
}

/**
 * Marks dashboard booking activity as seen for the signed-in host.
 * Recent notifications remain available; this only clears the unseen badge.
 */
export const runtime = 'edge'

export async function POST() {
  try {
    const auth = await getAuthenticatedProfile()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const notificationsSeenAt = new Date().toISOString()
    const { error } = await createAdminBackendClient()
      .from('user_settings')
      .upsert(
        {
          profile_id: auth.profile.id,
          notifications_seen_at: notificationsSeenAt,
          updated_at: notificationsSeenAt,
        },
        { onConflict: 'profile_id' }
      )

    if (error) {
      console.error('Error marking dashboard notifications seen:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to mark notifications as read' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      notificationsSeenAt,
    })
  } catch (error) {
    console.error('Error in POST /api/notifications/seen:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
