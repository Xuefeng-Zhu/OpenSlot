'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { BookingWithEventType } from './page'

type StatusFilter = 'all' | 'confirmed' | 'cancelled'

interface BookingsListProps {
  bookings: BookingWithEventType[]
  hostTimezone: string
}

function formatTimeInTimezone(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    // Fallback if timezone is invalid
    return new Date(isoString).toLocaleString()
  }
}

function formatTimeRange(startAt: string, endAt: string, timezone: string): string {
  try {
    const start = new Date(startAt)
    const end = new Date(endAt)

    const dateStr = start.toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    const startTime = start.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    const endTime = end.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    return `${dateStr} · ${startTime} – ${endTime}`
  } catch {
    return `${formatTimeInTimezone(startAt, timezone)} – ${formatTimeInTimezone(endAt, timezone)}`
  }
}

export function BookingsList({ bookings, hostTimezone }: BookingsListProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithEventType | null>(null)

  const filteredBookings = bookings.filter((booking) => {
    if (statusFilter === 'all') return true
    return booking.status === statusFilter
  })

  async function handleCancel() {
    if (!selectedBooking) return

    setCancellingId(selectedBooking.id)

    try {
      const response = await fetch(`/api/bookings/${selectedBooking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancellationToken: selectedBooking.cancellation_token,
          cancelReason: 'Cancelled by host',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        console.error('Failed to cancel booking:', data.error)
        return
      }

      setDialogOpen(false)
      setSelectedBooking(null)
      router.refresh()
    } catch (err) {
      console.error('Unexpected error cancelling booking:', err)
    } finally {
      setCancellingId(null)
    }
  }

  function openCancelDialog(booking: BookingWithEventType) {
    setSelectedBooking(booking)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex gap-2">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          All
        </Button>
        <Button
          variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('confirmed')}
        >
          Confirmed
        </Button>
        <Button
          variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('cancelled')}
        >
          Cancelled
        </Button>
      </div>

      {/* Bookings list */}
      {filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              {statusFilter === 'all'
                ? 'You don\u2019t have any bookings yet.'
                : `No ${statusFilter} bookings found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map((booking) => (
            <Card key={booking.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    {booking.guest_name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {booking.guest_email}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={booking.status === 'confirmed' ? 'default' : 'destructive'}
                    className={
                      booking.status === 'confirmed'
                        ? 'bg-green-600 hover:bg-green-600/80'
                        : ''
                    }
                  >
                    {booking.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}
                  </Badge>
                  {booking.status === 'confirmed' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openCancelDialog(booking)}
                      disabled={cancellingId === booking.id}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Event:</span>{' '}
                    {booking.event_type_title}
                  </p>
                  <p>
                    <span className="font-medium">Time:</span>{' '}
                    {formatTimeRange(booking.start_at, booking.end_at, hostTimezone)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the booking with{' '}
              <span className="font-medium">{selectedBooking?.guest_name}</span>
              {selectedBooking && (
                <>
                  {' '}on{' '}
                  {formatTimeRange(
                    selectedBooking.start_at,
                    selectedBooking.end_at,
                    hostTimezone
                  )}
                </>
              )}
              ? This action cannot be undone. The guest will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={cancellingId !== null}
            >
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancellingId !== null}
            >
              {cancellingId ? 'Cancelling...' : 'Cancel Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
