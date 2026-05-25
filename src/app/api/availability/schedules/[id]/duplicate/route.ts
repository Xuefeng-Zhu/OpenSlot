import { NextRequest, NextResponse } from 'next/server'
import { createAdminBackendClient, createServerBackendClient } from '@/lib/backend/server'
import { parseJsonBody } from '@/lib/http/json'
import type { InsertTables, Tables } from '@/lib/types/database'
import { duplicateScheduleSchema } from '@/lib/validations/availability'
import { getAuthenticatedAvailabilityProfile } from '../../../availability-route-utils'

interface DuplicateScheduleRouteContext {
  params: Promise<{ id: string }>
}

/**
 * Duplicates an owned schedule's weekly rules and date-specific overrides.
 * Event type assignments are intentionally not copied to the new schedule.
 */
export const runtime = 'edge'

export async function POST(
  request: NextRequest,
  { params }: DuplicateScheduleRouteContext
) {
  try {
    const { id } = await params
    const backendClient = await createServerBackendClient()
    const auth = await getAuthenticatedAvailabilityProfile(backendClient)

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const json = await parseJsonBody(request)
    if (!json.ok) return json.response

    const parsed = duplicateScheduleSchema.safeParse(json.body)

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

    const adminClient = createAdminBackendClient()
    const { data: sourceSchedule, error: sourceError } = await adminClient
      .from('schedules')
      .select('id, timezone')
      .eq('id', id)
      .eq('user_id', auth.profile.id)
      .single()

    if (sourceError || !sourceSchedule) {
      if (sourceError?.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Schedule not found' },
          { status: 404 }
        )
      }

      console.error('Error loading schedule to duplicate:', sourceError)
      return NextResponse.json(
        { success: false, error: 'Failed to load schedule' },
        { status: 500 }
      )
    }

    const { data: rules, error: rulesError } = await adminClient
      .from('availability_rules')
      .select('weekday, start_time, end_time, timezone, is_active')
      .eq('user_id', auth.profile.id)
      .eq('schedule_id', id)

    if (rulesError) {
      console.error('Error loading schedule rules to duplicate:', rulesError)
      return NextResponse.json(
        { success: false, error: 'Failed to load schedule rules' },
        { status: 500 }
      )
    }

    const { data: overrides, error: overridesError } = await adminClient
      .from('availability_overrides')
      .select('date, start_time, end_time, timezone, is_available, reason')
      .eq('user_id', auth.profile.id)
      .eq('schedule_id', id)

    if (overridesError) {
      console.error(
        'Error loading schedule overrides to duplicate:',
        overridesError
      )
      return NextResponse.json(
        { success: false, error: 'Failed to load schedule overrides' },
        { status: 500 }
      )
    }

    const { data: duplicatedSchedule, error: insertScheduleError } =
      await adminClient
        .from('schedules')
        .insert({
          user_id: auth.profile.id,
          name: parsed.data.name,
          timezone: sourceSchedule.timezone,
          is_default: false,
        })
        .select('id, name, timezone, is_default')
        .single()

    if (insertScheduleError || !duplicatedSchedule) {
      console.error('Error creating duplicated schedule:', insertScheduleError)
      return NextResponse.json(
        { success: false, error: 'Failed to duplicate schedule' },
        { status: 500 }
      )
    }

    const cleanupDuplicatedSchedule = async () => {
      const { error: cleanupError } = await adminClient
        .from('schedules')
        .delete()
        .eq('id', duplicatedSchedule.id)
        .eq('user_id', auth.profile.id)

      if (cleanupError) {
        console.error('Error cleaning up failed duplicated schedule:', cleanupError)
      }
    }

    const ruleRows: Array<InsertTables<'availability_rules'>> = (
      (rules ?? []) as Array<
        Pick<
          Tables<'availability_rules'>,
          'weekday' | 'start_time' | 'end_time' | 'timezone' | 'is_active'
        >
      >
    ).map((rule) => ({
      user_id: auth.profile.id,
      schedule_id: duplicatedSchedule.id,
      weekday: rule.weekday,
      start_time: rule.start_time,
      end_time: rule.end_time,
      timezone: rule.timezone,
      is_active: rule.is_active,
    }))

    if (ruleRows.length > 0) {
      const { error: insertRulesError } = await adminClient
        .from('availability_rules')
        .insert(ruleRows)

      if (insertRulesError) {
        console.error('Error copying schedule rules:', insertRulesError)
        await cleanupDuplicatedSchedule()
        return NextResponse.json(
          { success: false, error: 'Failed to copy schedule rules' },
          { status: 500 }
        )
      }
    }

    const overrideRows: Array<InsertTables<'availability_overrides'>> = (
      (overrides ?? []) as Array<
        Pick<
          Tables<'availability_overrides'>,
          | 'date'
          | 'start_time'
          | 'end_time'
          | 'timezone'
          | 'is_available'
          | 'reason'
        >
      >
    ).map((override) => ({
      user_id: auth.profile.id,
      schedule_id: duplicatedSchedule.id,
      date: override.date,
      start_time: override.start_time,
      end_time: override.end_time,
      timezone: override.timezone,
      is_available: override.is_available,
      reason: override.reason,
    }))

    if (overrideRows.length > 0) {
      const { error: insertOverridesError } = await adminClient
        .from('availability_overrides')
        .insert(overrideRows)

      if (insertOverridesError) {
        console.error('Error copying schedule overrides:', insertOverridesError)
        await cleanupDuplicatedSchedule()
        return NextResponse.json(
          { success: false, error: 'Failed to copy schedule overrides' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { success: true, schedule: duplicatedSchedule },
      { status: 201 }
    )
  } catch (error) {
    console.error(
      'Error in POST /api/availability/schedules/[id]/duplicate:',
      error
    )
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
