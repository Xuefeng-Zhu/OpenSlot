"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ScheduleNameDialogProps {
  open: boolean
  name: string
  isSavingSchedule: boolean
  onOpenChange: (open: boolean) => void
  onNameChange: (name: string) => void
  onSubmit: () => void
}

export function CreateScheduleDialog({
  open,
  name,
  isSavingSchedule,
  onOpenChange,
  onNameChange,
  onSubmit,
}: ScheduleNameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create schedule</DialogTitle>
          <DialogDescription>
            Add a named schedule that can be assigned to event types.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-schedule-name">New schedule</Label>
          <Input
            id="new-schedule-name"
            placeholder="e.g. Sales calls"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSavingSchedule || !name.trim()}
          >
            Create schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RenameScheduleDialog({
  open,
  name,
  isSavingSchedule,
  onOpenChange,
  onNameChange,
  onSubmit,
  originalName,
}: ScheduleNameDialogProps & { originalName: string | undefined }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename schedule</DialogTitle>
          <DialogDescription>
            Update the display name for this availability schedule.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="schedule-name">Schedule name</Label>
          <Input
            id="schedule-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={
              isSavingSchedule || !name.trim() || name.trim() === originalName
            }
          >
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DuplicateScheduleDialog({
  open,
  name,
  isSavingSchedule,
  onOpenChange,
  onNameChange,
  onSubmit,
}: ScheduleNameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate schedule</DialogTitle>
          <DialogDescription>
            Copy weekly hours and date-specific hours into a new schedule.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="duplicate-schedule-name">Schedule name</Label>
          <Input
            id="duplicate-schedule-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSavingSchedule || !name.trim()}
          >
            Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteScheduleDialogProps {
  open: boolean
  scheduleName: string | undefined
  deleteBlockedReason: string | null
  isSavingSchedule: boolean
  canDeleteSelectedSchedule: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}

export function DeleteScheduleDialog({
  open,
  scheduleName,
  deleteBlockedReason,
  isSavingSchedule,
  canDeleteSelectedSchedule,
  onOpenChange,
  onSubmit,
}: DeleteScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete schedule</DialogTitle>
          <DialogDescription>
            {deleteBlockedReason ??
              `Delete "${scheduleName}"? This cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onSubmit}
            disabled={isSavingSchedule || !canDeleteSelectedSchedule}
          >
            Delete schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
