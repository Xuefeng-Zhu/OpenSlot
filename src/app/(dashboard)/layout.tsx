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
import {
  optionalPageRow,
  pageUserOrNull,
} from '@/lib/backend/page-data'

export const runtime = 'edge'
export const metadata = routeMetadata.dashboard

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const backendClient = await createServerBackendClient()

  const user = pageUserOrNull(await backendClient.auth.getUser())

  if (!user) {
    redirect('/login')
  }

  const typedProfile = optionalPageRow(
    await backendClient
      .from('profiles')
      .select('id, name, email, username, default_timezone')
      .eq('auth_user_id', user.id)
      .single(),
    'dashboard profile'
  ) as Pick<
      Tables<'profiles'>,
      'id' | 'name' | 'email' | 'username' | 'default_timezone'
    > | null

  const typedSettings = typedProfile
    ? (optionalPageRow(
        await backendClient
          .from('user_settings')
          .select('date_format, time_format')
          .eq('profile_id', typedProfile.id)
          .maybeSingle(),
        'dashboard display preferences'
      ) as Pick<
        Tables<'user_settings'>,
        'date_format' | 'time_format'
      > | null)
    : null
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
