import { redirect } from 'next/navigation'
import {
  emptyDashboardNotifications,
  listDashboardNotifications,
} from '@/lib/dashboard/notifications'
import { createAdminBackendClient, createServerBackendClient } from '@/lib/backend/server'
import { DashboardShell } from './dashboard-shell'
import type { Tables } from '@/lib/types/database'

export const runtime = 'edge'

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
    .select('id, name, email, username')
    .eq('auth_user_id', user.id)
    .single()

  const typedProfile = profile as Pick<
    Tables<'profiles'>,
    'id' | 'name' | 'email' | 'username'
  > | null
  const notifications = typedProfile
    ? await listDashboardNotifications(createAdminBackendClient(), typedProfile.id)
    : emptyDashboardNotifications

  return (
    <DashboardShell
      notifications={notifications}
      user={{
        name: typedProfile?.name || '',
        email: typedProfile?.email || user.email || '',
        username: typedProfile?.username || '',
      }}
    >
      {children}
    </DashboardShell>
  )
}
