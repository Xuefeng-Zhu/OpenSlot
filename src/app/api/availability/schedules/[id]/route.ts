import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateScheduleSchema } from '@/lib/validations/availability'
import {
  getAuthenticatedAvailabilityProfile,
  loadOwnedSchedule,
} from '../../availability-route-utils'

interface ScheduleRouteContext {
  params: Promise<{ id: string }>
}

/**
 * Renames a host schedule and/or promotes it to the host default schedule.
 */
export const runtime = 'edge'

export async function PATCH(
  request: NextRequest,
  { params }: ScheduleRouteContext
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const auth = await getAuthenticatedAvailabilityProfile(supabase)

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const body = await request.json()
    const parsed = updateScheduleSchema.safeParse(body)

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
    const scheduleResult = await loadOwnedSchedule(
      adminClient,
      id,
      auth.profile.id
    )

    if (!scheduleResult.ok) {
      return NextResponse.json(
        { success: false, error: scheduleResult.error },
        { status: scheduleResult.status }
      )
    }

    const now = new Date().toISOString()

    if (parsed.data.isDefault) {
      const { data: schedule, error } = await adminClient
        .rpc('set_default_schedule', {
          p_user_id: auth.profile.id,
          p_schedule_id: id,
          p_name: parsed.data.name ?? null,
          p_update_name: parsed.data.name !== undefined,
        })
        .single()

      if (error) {
        console.error('Error updating default schedule:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to update default schedule' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, schedule })
    }

    const patch: {
      name?: string
      updated_at: string
    } = { updated_at: now }

    if (parsed.data.name !== undefined) patch.name = parsed.data.name

    const { data: schedule, error } = await adminClient
      .from('schedules')
      .update(patch)
      .eq('id', id)
      .eq('user_id', auth.profile.id)
      .select('id, name, timezone, is_default')
      .single()

    if (error) {
      console.error('Error updating schedule:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, schedule })
  } catch (error) {
    console.error('Error in PATCH /api/availability/schedules/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Deletes an unassigned, non-default schedule. Rules and overrides cascade.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: ScheduleRouteContext
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const auth = await getAuthenticatedAvailabilityProfile(supabase)

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const adminClient = createAdminClient()
    const scheduleResult = await loadOwnedSchedule(
      adminClient,
      id,
      auth.profile.id
    )

    if (!scheduleResult.ok) {
      return NextResponse.json(
        { success: false, error: scheduleResult.error },
        { status: scheduleResult.status }
      )
    }

    if (scheduleResult.schedule.is_default) {
      return NextResponse.json(
        { success: false, error: 'Default schedules cannot be deleted' },
        { status: 409 }
      )
    }

    const { count, error: countError } = await adminClient
      .from('event_types')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.profile.id)
      .eq('schedule_id', id)

    if (countError) {
      console.error('Error checking schedule event types:', countError)
      return NextResponse.json(
        { success: false, error: 'Failed to check schedule usage' },
        { status: 500 }
      )
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Schedules assigned to event types cannot be deleted',
        },
        { status: 409 }
      )
    }

    const { error } = await adminClient
      .from('schedules')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.profile.id)

    if (error) {
      console.error('Error deleting schedule:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/availability/schedules/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
