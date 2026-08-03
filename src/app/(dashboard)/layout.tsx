import { redirect } from 'next/navigation'
import {
  emptyDashboardNotifications,
  listDashboardNotifications,
} from '@/lib/dashboard/notifications'
import { createAdminBackendClient, createServerBackendClient } from '@/lib/backend/server'
import { DashboardShell } from './dashboard-shell'
import type { Tables } from '@/lib/types/database'
import { routeMetadata } from '@/app/route-metadata'
import { DashboardDisplayPreferencesProvider } from '@/components/dashboard/display-preferences-provider'
import { normalizeDashboardDisplayPreferences } from '@/lib/dashboard/display-preferences'

export const runtime = 'edge'
export const metadata = routeMetadata.dashboard

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const backendClient = await createServerBackendClient()

  const {
    data: { user },
  } = await backendClient.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await backendClient
    .from('profiles')
    .select('id, name, email, username, default_timezone')
    .eq('auth_user_id', user.id)
    .single()

  const typedProfile = profile as Pick<
    Tables<'profiles'>,
    'id' | 'name' | 'email' | 'username' | 'default_timezone'
  > | null

  const { data: settings, error: settingsError } = typedProfile
    ? await backendClient
        .from('user_settings')
        .select('date_format, time_format')
        .eq('profile_id', typedProfile.id)
        .maybeSingle()
    : { data: null, error: null }

  if (settingsError) {
    throw new Error('Failed to load dashboard display preferences')
  }

  const typedSettings = settings as Pick<
    Tables<'user_settings'>,
    'date_format' | 'time_format'
  > | null
  const displayPreferences = normalizeDashboardDisplayPreferences({
    timezone: typedProfile?.default_timezone,
    dateFormat: typedSettings?.date_format,
    timeFormat: typedSettings?.time_format,
  })
  const notifications = typedProfile
    ? await listDashboardNotifications(createAdminBackendClient(), typedProfile.id)
    : emptyDashboardNotifications

  return (
    <DashboardDisplayPreferencesProvider preferences={displayPreferences}>
      <DashboardShell
        notifications={notifications}
        user={{
          name: typedProfile?.name || '',
          email: user.email || typedProfile?.email || '',
          username: typedProfile?.username || '',
        }}
      >
        {children}
      </DashboardShell>
    </DashboardDisplayPreferencesProvider>
  )
}
