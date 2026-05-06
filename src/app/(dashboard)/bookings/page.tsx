import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/types/database'
import { BookingsList } from './bookings-list'

export type BookingWithEventType = Tables<'bookings'> & {
  event_type_title: string
}

export default async function BookingsPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get the user's profile including default_timezone
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, default_timezone')
    .eq('auth_user_id', user.id)
    .single()

  const profile = profileData as Pick<Tables<'profiles'>, 'id' | 'default_timezone'> | null

  if (!profile) {
    redirect('/profile')
  }

  // Fetch all bookings for this host, joined with event_types for the title
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select('*, event_types(title)')
    .eq('host_user_id', profile.id)
    .order('start_at', { ascending: true })

  const bookings: BookingWithEventType[] = (bookingsData ?? []).map((booking: Record<string, unknown>) => {
    const eventTypes = booking.event_types as { title: string } | null
    const { event_types: _, ...rest } = booking
    return {
      ...rest,
      event_type_title: eventTypes?.title ?? 'Unknown Event',
    } as BookingWithEventType
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground">
          View and manage your upcoming bookings.
        </p>
      </div>

      <BookingsList
        bookings={bookings}
        hostTimezone={profile.default_timezone}
      />
    </div>
  )
}
