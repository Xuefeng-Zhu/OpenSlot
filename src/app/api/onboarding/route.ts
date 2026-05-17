import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  buildOnboardingAvailabilityRules,
  buildOnboardingEventSlug,
  onboardingSchema,
} from '@/lib/validations/onboarding'

type OnboardingWriteClient = {
  from: (
    table: 'profiles' | 'schedules' | 'event_types' | 'availability_rules'
  ) => any
}

/**
 * Persists the MVP onboarding bundle for a newly signed-in host.
 * The flow upserts the profile and starter event type, then replaces onboarding
 * availability rules so repeated submissions produce the same baseline setup.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = onboardingSchema.safeParse(body)

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

    // Prefer service-role writes because onboarding may create the first profile
    // before authenticated RLS policies can resolve profile ownership.
    const writeClient = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
    ) as OnboardingWriteClient
    const { profile, availability, eventType, timezone } = parsed.data
    const now = new Date().toISOString()
    const eventSlug = buildOnboardingEventSlug(eventType.title)

    const { data: savedProfile, error: saveProfileError } = await writeClient
      .from('profiles')
      .upsert(
        {
          auth_user_id: user.id,
          email: user.email ?? '',
          name: profile.displayName,
          username: profile.username,
          default_timezone: timezone,
          updated_at: now,
        },
        { onConflict: 'auth_user_id' }
      )
      .select('id')
      .single()

    if (saveProfileError) {
      if (
        saveProfileError.code === '23505' &&
        saveProfileError.message.includes('username')
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'This username is already taken. Please choose another.',
          },
          { status: 409 }
        )
      }

      console.error('Error saving onboarding profile:', saveProfileError)
      return NextResponse.json(
        {
          success: false,
          error:
            'Failed to save profile. Apply migration 011_allow_profile_insert.sql or configure SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 500 }
      )
    }

    const profileId = savedProfile?.id

    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'Failed to save profile' },
        { status: 500 }
      )
    }

    const { data: existingSchedule, error: scheduleLookupError } =
      await writeClient
        .from('schedules')
        .select('id')
        .eq('user_id', profileId)
        .eq('is_default', true)
        .maybeSingle()

    if (scheduleLookupError) {
      console.error('Error loading onboarding schedule:', scheduleLookupError)
      return NextResponse.json(
        { success: false, error: 'Failed to save schedule' },
        { status: 500 }
      )
    }

    let scheduleId = existingSchedule?.id as string | undefined

    if (!scheduleId) {
      const { data: savedSchedule, error: scheduleError } = await writeClient
        .from('schedules')
        .insert({
          user_id: profileId,
          name: 'Default schedule',
          timezone,
          is_default: true,
        })
        .select('id')
        .single()

      if (scheduleError || !savedSchedule?.id) {
        console.error('Error saving onboarding schedule:', scheduleError)
        return NextResponse.json(
          { success: false, error: 'Failed to save schedule' },
          { status: 500 }
        )
      }

      scheduleId = savedSchedule.id
    }

    const { data: savedEventType, error: eventTypeError } =
      await writeClient
        .from('event_types')
        .upsert(
          {
            user_id: profileId,
            schedule_id: scheduleId,
            title: eventType.title,
            slug: eventSlug,
            description: '',
            duration_minutes: eventType.duration,
            buffer_before_minutes: 0,
            buffer_after_minutes: 0,
            min_notice_minutes: 60,
            max_booking_days_ahead: 60,
            location_type: 'custom',
            location_value: eventType.location,
            is_active: true,
            updated_at: now,
          },
          { onConflict: 'user_id,slug' }
        )
        .select('slug')
        .single()

    if (eventTypeError) {
      console.error('Error saving onboarding event type:', eventTypeError)
      return NextResponse.json(
        { success: false, error: 'Failed to save event type' },
        { status: 500 }
      )
    }

    const { error: deleteRulesError } = await writeClient
      .from('availability_rules')
      .delete()
      .eq('user_id', profileId)

    if (deleteRulesError) {
      console.error('Error clearing onboarding availability:', deleteRulesError)
      return NextResponse.json(
        { success: false, error: 'Failed to save availability' },
        { status: 500 }
      )
    }

    const rules = buildOnboardingAvailabilityRules(availability).map((rule) => ({
      ...rule,
      user_id: profileId,
      schedule_id: scheduleId,
      timezone,
    }))

    if (rules.length > 0) {
      const { error: insertRulesError } = await writeClient
        .from('availability_rules')
        .insert(rules)

      if (insertRulesError) {
        console.error('Error inserting onboarding availability:', insertRulesError)
        return NextResponse.json(
          { success: false, error: 'Failed to save availability' },
          { status: 500 }
        )
      }
    }

    const bookingLink = `/${profile.username}/${savedEventType?.slug ?? eventSlug}`

    return NextResponse.json({
      success: true,
      bookingLink,
    })
  } catch (error) {
    console.error('Error in POST /api/onboarding:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
