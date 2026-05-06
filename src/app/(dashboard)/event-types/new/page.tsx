import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EventTypeForm } from '@/components/dashboard/event-type-form'

export default function NewEventTypePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Event Type</h1>
        <p className="text-muted-foreground">
          Set up a new event type that guests can book.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Type Details</CardTitle>
          <CardDescription>
            Configure the duration, buffers, and location for this event type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventTypeForm mode="create" />
        </CardContent>
      </Card>
    </div>
  )
}
