import { redirect } from 'next/navigation'
import { createServerBackendClient } from '@/lib/backend/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { ProfileForm } from './profile-form'
import type { Tables } from '@/lib/types/database'
import { routeMetadata } from '@/app/route-metadata'

export const metadata = routeMetadata.profile

export default async function ProfilePage() {
  const backendClient = await createServerBackendClient()

  const {
    data: { user },
  } = await backendClient.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await backendClient
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  const typedProfile = profile as Tables<'profiles'> | null

  if (!typedProfile) {
    redirect('/onboarding')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Profile"
        description="Control the public identity and booking URL guests see when they book."
      />
      <ProfileForm
        initialData={{
          name: typedProfile.name || '',
          username: typedProfile.username || '',
          public_headline: typedProfile.public_headline || '',
          public_bio: typedProfile.public_bio || '',
          response_time_label: typedProfile.response_time_label || '',
        }}
      />
    </div>
  )
}
