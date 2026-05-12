import { redirect } from 'next/navigation'
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
    .select('name, email, username')
    .eq('auth_user_id', user.id)
    .single()

  const typedProfile = profile as Pick<
    Tables<'profiles'>,
    'name' | 'email' | 'username'
  > | null

  return (
    <DashboardShell
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
