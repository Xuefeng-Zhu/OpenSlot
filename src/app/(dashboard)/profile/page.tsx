import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProfileForm } from './profile-form'
import type { Tables } from '@/lib/types/database'

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  const typedProfile = profile as Tables<'profiles'> | null

  if (!typedProfile) {
    redirect('/login')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
      <ProfileForm
        initialData={{
          name: typedProfile.name || '',
          username: typedProfile.username || '',
          default_timezone: typedProfile.default_timezone || 'UTC',
        }}
      />
    </div>
  )
}
