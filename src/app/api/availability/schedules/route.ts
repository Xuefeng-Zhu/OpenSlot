import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createScheduleSchema } from '@/lib/validations/availability'
import { getAuthenticatedAvailabilityProfile } from '../availability-route-utils'

/**
 * Creates a named availability schedule owned by the authenticated host.
 * New schedules are non-default until explicitly promoted.
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const auth = await getAuthenticatedAvailabilityProfile(supabase)

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const body = await request.json()
    const parsed = createScheduleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    const { data: schedule, error } = await adminClient
      .from('schedules')
      .insert({
        user_id: auth.profile.id,
        name: parsed.data.name,
        timezone: parsed.data.timezone ?? auth.profile.default_timezone,
        is_default: false,
      })
      .select('id, name, timezone, is_default')
      .single()

    if (error) {
      console.error('Error creating schedule:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, schedule }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/availability/schedules:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
