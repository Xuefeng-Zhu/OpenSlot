import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_EMAIL_UPDATE_UNAVAILABLE } from '@/lib/auth/account-mutation-policy'
import { getAuthenticatedProfile } from '@/lib/auth/get-authenticated-profile'
import {
  createAdminBackendClient,
  createServerBackendClient,
} from '@/lib/backend/server'
import { parseJsonBody } from '@/lib/http/json'
import {
  isLegacyFullSettingsPayload,
  settingsPatchSchema,
} from '@/lib/validations/settings'

/**
 * Saves exactly one preference or notification settings section for the
 * signed-in host. Account email writes fail closed until Butterbase exposes a
 * service-auth mutation that can safely keep Auth and profile data in sync.
 */
export const runtime = 'edge'

export async function PATCH(request: NextRequest) {
  try {
    const userClient = await createServerBackendClient()
    const auth = await getAuthenticatedProfile(userClient)

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const body = await parseJsonBody(request)
    if (!body.ok) return body.response

    if (isLegacyFullSettingsPayload(body.body)) {
      return NextResponse.json(
        {
          success: false,
          code: 'SETTINGS_CLIENT_OUTDATED',
          error: 'This settings page is out of date. Reload it and try again.',
        },
        { status: 409 }
      )
    }

    const parsed = settingsPatchSchema.safeParse(body.body)

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

    if (settings.section === 'account') {
      return NextResponse.json(
        {
          success: false,
          code: ACCOUNT_EMAIL_UPDATE_UNAVAILABLE.code,
          error: ACCOUNT_EMAIL_UPDATE_UNAVAILABLE.message,
        },
        { status: ACCOUNT_EMAIL_UPDATE_UNAVAILABLE.status }
      )
    }

    const adminClient = createAdminBackendClient()
    const now = new Date().toISOString()

    if (settings.section === 'preferences') {
      const { error: preferencesError } = await adminClient
        .rpc('save_dashboard_preferences', {
          p_profile_id: auth.profileId,
          p_default_timezone: settings.defaultTimezone,
          p_date_format: settings.dateFormat,
          p_time_format: settings.timeFormat,
        })
        .single()

      if (preferencesError) {
        console.error('Atomic dashboard preference update failed')
        return NextResponse.json(
          {
            success: false,
            code: 'PREFERENCES_UPDATE_FAILED',
            error: 'Preferences were not changed. Please try again.',
          },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }

    const settingsPayload = {
      profile_id: auth.profileId,
      notify_new_booking: settings.notifyNewBooking,
      notify_cancellation: settings.notifyCancellation,
      notify_reminder: settings.notifyReminder,
      updated_at: now,
    }

    const { error: settingsError } = await adminClient
      .from('user_settings')
      .upsert(settingsPayload, { onConflict: 'profile_id' })

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
 * Deletes the signed-in Butterbase Auth user.
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

    const adminClient = createAdminBackendClient()
    const { error } = await adminClient.auth.admin?.deleteUser(auth.userId) ?? {
      error: { message: 'Admin auth is unavailable' },
    }

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
