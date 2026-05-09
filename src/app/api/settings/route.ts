import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { settingsSchema } from '@/lib/validations/settings'

async function getAuthenticatedProfile() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: 'Unauthorized',
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, auth_user_id')
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
    user,
    profile: profile as { id: string; auth_user_id: string },
  }
}

/**
 * Saves profile and notification/preference settings for the signed-in host.
 * Email changes go through Supabase Auth on the client before this route persists
 * the app profile and user_settings rows.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedProfile()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = settingsSchema.safeParse(body)

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

    const settings = parsed.data
    const adminClient = createAdminClient()
    const now = new Date().toISOString()

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        name: settings.name,
        email: settings.email,
        default_timezone: settings.defaultTimezone,
        updated_at: now,
      })
      .eq('id', auth.profile.id)

    if (profileError) {
      console.error('Error updating profile settings:', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to update profile settings' },
        { status: 500 }
      )
    }

    const { error: settingsError } = await adminClient
      .from('user_settings')
      .upsert(
        {
          profile_id: auth.profile.id,
          date_format: settings.dateFormat,
          time_format: settings.timeFormat,
          notify_new_booking: settings.notifyNewBooking,
          notify_cancellation: settings.notifyCancellation,
          notify_reminder: settings.notifyReminder,
          updated_at: now,
        },
        { onConflict: 'profile_id' }
      )

    if (settingsError) {
      console.error('Error updating user settings:', settingsError)
      return NextResponse.json(
        { success: false, error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PATCH /api/settings:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Deletes the signed-in Supabase Auth user.
 * Related app data is expected to be removed by database-level ownership rules
 * or follow-up cleanup tied to the auth user.
 */
export async function DELETE() {
  try {
    const auth = await getAuthenticatedProfile()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient.auth.admin.deleteUser(auth.user.id)

    if (error) {
      console.error('Error deleting account:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/settings:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
