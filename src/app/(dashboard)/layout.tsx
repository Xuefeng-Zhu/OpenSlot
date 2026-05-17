import { redirect } from 'next/navigation'
import {
  emptyDashboardNotifications,
  listDashboardNotifications,
} from '@/lib/dashboard/notifications'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { DashboardShell } from './dashboard-shell'
import type { Tables } from '@/lib/types/database'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, username')
    .eq('auth_user_id', user.id)
    .single()

  const typedProfile = profile as Pick<
    Tables<'profiles'>,
    'id' | 'name' | 'email' | 'username'
  > | null
  const notifications = typedProfile
    ? await listDashboardNotifications(createAdminClient(), typedProfile.id)
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
