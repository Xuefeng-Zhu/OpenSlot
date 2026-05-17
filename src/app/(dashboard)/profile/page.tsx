import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
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
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Profile"
        description="Control the public name, booking URL, and default timezone guests see when they book."
      />
      <ProfileForm
        initialData={{
          name: typedProfile.name || '',
          username: typedProfile.username || '',
          default_timezone: typedProfile.default_timezone || 'UTC',
          public_headline: typedProfile.public_headline || '',
          public_bio: typedProfile.public_bio || '',
          response_time_label: typedProfile.response_time_label || '',
        }}
      />
    </div>
  )
}
