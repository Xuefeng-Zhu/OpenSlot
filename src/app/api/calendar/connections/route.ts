import { NextResponse } from 'next/server'
import { createAdminBackendClient, createServerBackendClient } from '@/lib/backend/server'
import { listCalendarConnectionSummaries } from '@/lib/calendar/connections'

/**
 * Returns safe calendar connection summaries for the authenticated profile.
 * The response is dashboard-facing metadata only; encrypted OAuth credentials
 * remain hidden in server-only tables.
 */
export const runtime = 'edge'

export async function GET() {
  try {
    const backendClient = await createServerBackendClient()
    const {
      data: { user },
      error: authError,
    } = await backendClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await backendClient
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    const connections = await listCalendarConnectionSummaries(
      createAdminBackendClient(),
      (profile as { id: string }).id
    )

    return NextResponse.json({ success: true, connections })
  } catch (error) {
    console.error('Error in GET /api/calendar/connections:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
