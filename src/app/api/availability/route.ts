import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { saveAvailabilitySchema } from '@/lib/validations/availability'

/**
 * POST /api/availability
 *
 * Batch save availability rules and overrides.
 * Performs deletes, then upserts (insert new / update existing) in a single request.
 *
 * Requires authentication. Uses the authenticated user's profile ID for all operations.
 * Uses the admin client (service role) to bypass RLS for write operations.
 *
 * Request body: { rules, overrides, deletedRuleIds, deletedOverrideIds, timezone }
 * Response: { success: true } or { success: false, error: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the user's profile ID
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    const profile = profileData as { id: string } | null

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 401 }
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

    const { rules, overrides, deletedRuleIds, deletedOverrideIds, timezone } = parsed.data
    const adminClient = createAdminClient()
    const userId = profile.id

    // Delete rules by IDs
    if (deletedRuleIds.length > 0) {
      const { error: deleteRulesError } = await adminClient
        .from('availability_rules')
        .delete()
        .in('id', deletedRuleIds)
        .eq('user_id', userId)

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
          })
          .eq('id', rule.id)
          .eq('user_id', userId)

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
          })
          .eq('id', override.id)
          .eq('user_id', userId)

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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/availability:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
