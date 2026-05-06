import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EventTypeActions } from './event-type-actions'
import type { Tables } from '@/lib/types/database'

export default async function EventTypesPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get the user's profile
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  const profile = profileData as Pick<Tables<'profiles'>, 'id'> | null

  if (!profile) {
    redirect('/profile')
  }

  // Fetch all event types for this user
  const { data: eventTypesData } = await supabase
    .from('event_types')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  const eventTypes = (eventTypesData ?? []) as Tables<'event_types'>[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Types</h1>
          <p className="text-muted-foreground">
            Manage your event types that guests can book.
          </p>
        </div>
        <Button asChild>
          <Link href="/event-types/new">Create Event Type</Link>
        </Button>
      </div>

      {eventTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              You haven&apos;t created any event types yet.
            </p>
            <Button asChild>
              <Link href="/event-types/new">Create Your First Event Type</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {eventTypes.map((eventType) => (
            <Card key={eventType.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{eventType.title}</CardTitle>
                  <CardDescription>
                    {eventType.duration_minutes} min
                    {eventType.location_type !== 'online' && ` · ${eventType.location_type.replace('_', ' ')}`}
                    {eventType.location_type === 'online' && ' · Online'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={eventType.is_active ? 'default' : 'secondary'}>
                    {eventType.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <EventTypeActions eventTypeId={eventType.id} eventTypeTitle={eventType.title} />
                </div>
              </CardHeader>
              {eventType.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{eventType.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
