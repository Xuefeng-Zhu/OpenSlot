'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface EventTypeActionsProps {
  eventTypeId: string
  eventTypeTitle: string
}

export function EventTypeActions({ eventTypeId, eventTypeTitle }: EventTypeActionsProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('event_types')
        .delete()
        .eq('id', eventTypeId)

      if (error) {
        console.error('Failed to delete event type:', error)
        return
      }

      setDialogOpen(false)
      router.refresh()
    } catch (err) {
      console.error('Unexpected error deleting event type:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/event-types/${eventTypeId}/edit`}>Edit</Link>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{eventTypeTitle}&quot;? This action cannot be undone.
              Any existing bookings for this event type will also be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
