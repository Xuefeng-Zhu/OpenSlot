import { NextRequest, NextResponse } from 'next/server'
import { createAdminBackendClient, createServerBackendClient } from '@/lib/backend/server'
import { saveAvailabilitySchema } from '@/lib/validations/availability'
import {
  getAuthenticatedAvailabilityProfile,
  loadOwnedSchedule,
} from './availability-route-utils'

/**
 * POST /api/availability
 *
 * Batch save availability rules and overrides.
 * Performs deletes, then upserts (insert new / update existing) in a single request.
 *
 * Requires authentication. Uses the authenticated user's profile ID for all operations.
 * Uses the admin client (service key) to bypass RLS for write operations.
 *
 * Request body: { rules, overrides, deletedRuleIds, deletedOverrideIds, timezone }
 * Response: { success: true } or { success: false, error: string }
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const backendClient = await createServerBackendClient()
    const auth = await getAuthenticatedAvailabilityProfile(backendClient)

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const parsed = saveAvailabilitySchema.safeParse(body)

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

    const {
      scheduleId,
      rules,
      overrides,
      deletedRuleIds,
      deletedOverrideIds,
      timezone,
    } = parsed.data
    const adminClient = createAdminBackendClient()
    const userId = auth.profile.id

    const scheduleResult = await loadOwnedSchedule(
      adminClient,
      scheduleId,
      userId
    )

    if (!scheduleResult.ok) {
      return NextResponse.json(
        { success: false, error: scheduleResult.error },
        { status: scheduleResult.status }
      )
    }

    const { error: updateScheduleError } = await adminClient
      .from('schedules')
      .update({ timezone, updated_at: new Date().toISOString() })
      .eq('id', scheduleId)
      .eq('user_id', userId)

    if (updateScheduleError) {
      console.error('Error updating schedule timezone:', updateScheduleError)
      return NextResponse.json(
        { success: false, error: 'Failed to update schedule' },
        { status: 500 }
      )
    }

    // Delete rules by IDs
    if (deletedRuleIds.length > 0) {
      const { error: deleteRulesError } = await adminClient
        .from('availability_rules')
        .delete()
        .in('id', deletedRuleIds)
        .eq('user_id', userId)
        .eq('schedule_id', scheduleId)

      if (deleteRulesError) {
        console.error('Error deleting availability rules:', deleteRulesError)
        return NextResponse.json(
          { success: false, error: 'Failed to delete availability rules' },
          { status: 500 }
        )
      }
    }

    // Delete overrides by IDs
    if (deletedOverrideIds.length > 0) {
      const { error: deleteOverridesError } = await adminClient
        .from('availability_overrides')
        .delete()
        .in('id', deletedOverrideIds)
        .eq('user_id', userId)
        .eq('schedule_id', scheduleId)

      if (deleteOverridesError) {
        console.error('Error deleting availability overrides:', deleteOverridesError)
        return NextResponse.json(
          { success: false, error: 'Failed to delete availability overrides' },
          { status: 500 }
        )
      }
    }

    // Upsert rules: update existing (has id) or insert new (no id)
    for (const rule of rules) {
      if (rule.id) {
        // Update existing rule
        const { error: updateError } = await adminClient
          .from('availability_rules')
          .update({
            weekday: rule.weekday,
            start_time: rule.start_time,
            end_time: rule.end_time,
            timezone,
            is_active: rule.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rule.id)
          .eq('user_id', userId)
          .eq('schedule_id', scheduleId)

        if (updateError) {
          console.error('Error updating availability rule:', updateError)
          return NextResponse.json(
            { success: false, error: 'Failed to update availability rule' },
            { status: 500 }
          )
        }
      } else {
        // Insert new rule
        const { error: insertError } = await adminClient
          .from('availability_rules')
          .insert({
            user_id: userId,
            schedule_id: scheduleId,
            weekday: rule.weekday,
            start_time: rule.start_time,
            end_time: rule.end_time,
            timezone,
            is_active: rule.is_active,
          })

        if (insertError) {
          console.error('Error inserting availability rule:', insertError)
          return NextResponse.json(
            { success: false, error: 'Failed to insert availability rule' },
            { status: 500 }
          )
        }
      }
    }

    // Upsert overrides: update existing (has id) or insert new (no id)
    for (const override of overrides) {
      if (override.id) {
        // Update existing override
        const { error: updateError } = await adminClient
          .from('availability_overrides')
          .update({
            date: override.date,
            start_time: override.start_time,
            end_time: override.end_time,
            timezone,
            is_available: override.is_available,
            reason: override.reason ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', override.id)
          .eq('user_id', userId)
          .eq('schedule_id', scheduleId)

        if (updateError) {
          console.error('Error updating availability override:', updateError)
          return NextResponse.json(
            { success: false, error: 'Failed to update availability override' },
            { status: 500 }
          )
        }
      } else {
        // Insert new override
        const { error: insertError } = await adminClient
          .from('availability_overrides')
          .insert({
            user_id: userId,
            schedule_id: scheduleId,
            date: override.date,
            start_time: override.start_time,
            end_time: override.end_time,
            timezone,
            is_available: override.is_available,
            reason: override.reason ?? null,
          })

        if (insertError) {
          console.error('Error inserting availability override:', insertError)
          return NextResponse.json(
            { success: false, error: 'Failed to insert availability override' },
            { status: 500 }
          )
        }
      }
    }

    const { data: savedRulesData, error: savedRulesError } = await adminClient
      .from('availability_rules')
      .select('id, weekday, start_time, end_time, is_active')
      .eq('user_id', userId)
      .eq('schedule_id', scheduleId)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true })

    if (savedRulesError) {
      console.error('Error loading saved availability rules:', savedRulesError)
      return NextResponse.json(
        { success: false, error: 'Failed to reload availability rules' },
        { status: 500 }
      )
    }

    const { data: savedOverridesData, error: savedOverridesError } =
      await adminClient
        .from('availability_overrides')
        .select('id, date, start_time, end_time, is_available, reason')
        .eq('user_id', userId)
        .eq('schedule_id', scheduleId)
        .order('date', { ascending: true })

    if (savedOverridesError) {
      console.error(
        'Error loading saved availability overrides:',
        savedOverridesError
      )
      return NextResponse.json(
        { success: false, error: 'Failed to reload availability overrides' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      rules: savedRulesData ?? [],
      overrides: savedOverridesData ?? [],
    })
  } catch (error) {
    console.error('Error in POST /api/availability:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
