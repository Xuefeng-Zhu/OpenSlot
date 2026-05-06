import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
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
    .select('name, email')
    .eq('auth_user_id', user.id)
    .single()

  const typedProfile = profile as Pick<Tables<'profiles'>, 'name' | 'email'> | null

  return (
    <div className="flex min-h-screen">
      <SidebarNav
        userName={typedProfile?.name || ''}
        userEmail={typedProfile?.email || user.email || ''}
      />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
