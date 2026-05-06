import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Tables } from '@/lib/types/database'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get the user's profile to find their profile ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  const typedProfile = profile as Pick<Tables<'profiles'>, 'id'> | null

  let upcomingBookings: Tables<'bookings'>[] = []

  if (typedProfile) {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('host_user_id', typedProfile.id)
      .eq('status', 'confirmed')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(5)

    upcomingBookings = (bookings as Tables<'bookings'>[] | null) ?? []
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No upcoming bookings. Share your booking page to start receiving
              bookings.
            </p>
          ) : (
            <ul className="space-y-3">
              {upcomingBookings.map((booking) => (
                <li
                  key={booking.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{booking.guest_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.guest_email}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      {new Date(booking.start_at).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(booking.start_at).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' – '}
                      {new Date(booking.end_at).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
