import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/auth/get-authenticated-profile'
import { syncAccountEmail } from '@/lib/auth/sync-account-email'
import { createAdminBackendClient } from '@/lib/backend/server'
import { parseJsonBody } from '@/lib/http/json'
import {
  isLegacyFullSettingsPayload,
  settingsPatchSchema,
} from '@/lib/validations/settings'

/**
 * Saves exactly one account, preference, or notification settings section for
 * the signed-in host. Account email changes synchronize Auth and profile data
 * server-side so hidden drafts from another tab cannot leak into the write.
 */
export const runtime = 'edge'

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedProfile()

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
    const adminClient = createAdminBackendClient()
    const now = new Date().toISOString()

    if (settings.section === 'account') {
      const result = await syncAccountEmail({
        userId: auth.userId,
        profileId: auth.profileId,
        currentEmail: auth.email,
        nextEmail: settings.email,
        client: adminClient,
      })

      if (!result.ok) {
        return NextResponse.json(
          { success: false, code: result.code, error: result.error },
          { status: result.status }
        )
      }

      return NextResponse.json({ success: true, email: result.email })
    }

    if (settings.section === 'preferences') {
      const { data: previousProfile, error: previousProfileError } =
        await adminClient
          .from('profiles')
          .select('default_timezone')
          .eq('id', auth.profileId)
          .single()

      if (previousProfileError || !previousProfile) {
        console.error(
          'Error loading existing profile preferences:',
          previousProfileError
        )
        return NextResponse.json(
          { success: false, error: 'Failed to update preferences' },
          { status: 500 }
        )
      }

      const { error: profileError } = await adminClient
        .from('profiles')
        .update({
          default_timezone: settings.defaultTimezone,
          updated_at: now,
        })
        .eq('id', auth.profileId)

      if (profileError) {
        console.error('Error updating profile preferences:', profileError)
        return NextResponse.json(
          { success: false, error: 'Failed to update preferences' },
          { status: 500 }
        )
      }

      const { error: settingsError } = await adminClient
        .from('user_settings')
        .upsert(
          {
            profile_id: auth.profileId,
            date_format: settings.dateFormat,
            time_format: settings.timeFormat,
            updated_at: now,
          },
          { onConflict: 'profile_id' }
        )

      if (!settingsError) {
        return NextResponse.json({ success: true })
      }

      console.error('Error updating display preferences:', settingsError)
      const { error: rollbackError } = await adminClient
        .from('profiles')
        .update({
          default_timezone: previousProfile.default_timezone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auth.profileId)

      if (rollbackError) {
        console.error('Error reconciling profile preferences:', rollbackError)
        return NextResponse.json(
          {
            success: false,
            code: 'PREFERENCES_RECONCILIATION_REQUIRED',
            error:
              'Preferences could not be synchronized. Reload before retrying.',
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          code: 'PREFERENCES_UPDATE_FAILED',
          error: 'Preferences were not changed. Please try again.',
        },
        { status: 500 }
      )
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
