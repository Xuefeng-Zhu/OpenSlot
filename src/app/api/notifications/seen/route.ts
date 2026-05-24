import { NextResponse } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/auth/get-authenticated-profile'
import { createAdminBackendClient } from '@/lib/backend/server'

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
          profile_id: auth.profileId,
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
