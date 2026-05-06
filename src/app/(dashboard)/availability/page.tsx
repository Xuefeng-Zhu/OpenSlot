import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AvailabilityEditor } from '@/components/dashboard/availability-editor'
import type { Tables } from '@/lib/types/database'

export default async function AvailabilityPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get the user's profile (for ID and default timezone)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, default_timezone')
    .eq('auth_user_id', user.id)
    .single()

  const typedProfile = profile as Pick<Tables<'profiles'>, 'id' | 'default_timezone'> | null

  if (!typedProfile) {
    redirect('/profile')
  }

  // Fetch existing availability rules
  const { data: rules } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('user_id', typedProfile.id)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })

  // Fetch existing availability overrides
  const { data: overridesData } = await supabase
    .from('availability_overrides')
    .select('*')
    .eq('user_id', typedProfile.id)
    .order('date', { ascending: true })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Availability</h1>
        <p className="text-muted-foreground">
          Configure when you&apos;re available for bookings. Times are in your default timezone ({typedProfile.default_timezone}).
        </p>
      </div>

      <AvailabilityEditor
        profileId={typedProfile.id}
        defaultTimezone={typedProfile.default_timezone}
        initialRules={(rules as Tables<'availability_rules'>[]) ?? []}
        initialOverrides={(overridesData as Tables<'availability_overrides'>[]) ?? []}
      />
    </div>
  )
}
