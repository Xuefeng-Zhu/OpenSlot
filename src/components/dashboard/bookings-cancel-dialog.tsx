"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Booking } from "@/lib/booking-utils"

interface BookingCancelDialogProps {
  booking: Booking | null
  open: boolean
  cancelReason: string
  cancelling: boolean
  onOpenChange: (open: boolean) => void
  onCancelReasonChange: (reason: string) => void
  onConfirm: () => void
}

export function BookingCancelDialog({
  booking,
  open,
  cancelReason,
  cancelling,
  onOpenChange,
  onCancelReasonChange,
  onConfirm,
}: BookingCancelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this booking with{" "}
            {booking?.guest_name}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Textarea
            id="cancel-reason"
            value={cancelReason}
            onChange={(event) => onCancelReasonChange(event.target.value)}
            placeholder="Provide a reason for cancellation..."
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep booking
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={cancelling}
          >
            {cancelling ? "Cancelling..." : "Confirm cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
