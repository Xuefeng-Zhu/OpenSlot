import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EventTypeForm } from '@/components/dashboard/event-type-form'
import type { EventTypeFormValues } from '@/lib/validations/event-type'
import type { Tables } from '@/lib/types/database'

interface EditEventTypePageProps {
  params: Promise<{ id: string }>
}

export default async function EditEventTypePage({ params }: EditEventTypePageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch the event type
  const { data: eventTypeData, error } = await supabase
    .from('event_types')
    .select('*')
    .eq('id', id)
    .single()

  const eventType = eventTypeData as Tables<'event_types'> | null

  if (error || !eventType) {
    notFound()
  }

  // Map database row to form values
  const initialData: EventTypeFormValues = {
    title: eventType.title,
    description: eventType.description || undefined,
    duration_minutes: eventType.duration_minutes,
    buffer_before_minutes: eventType.buffer_before_minutes,
    buffer_after_minutes: eventType.buffer_after_minutes,
    min_notice_minutes: eventType.min_notice_minutes,
    max_booking_days_ahead: eventType.max_booking_days_ahead,
    location_type: eventType.location_type as 'online' | 'phone' | 'in_person' | 'custom',
    location_value: eventType.location_value || undefined,
    is_active: eventType.is_active,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Event Type</h1>
        <p className="text-muted-foreground">
          Update the settings for &quot;{eventType.title}&quot;.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Type Details</CardTitle>
          <CardDescription>
            Modify the duration, buffers, and location for this event type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventTypeForm mode="edit" initialData={initialData} eventTypeId={id} />
        </CardContent>
      </Card>
    </div>
  )
}
