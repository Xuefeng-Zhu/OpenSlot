"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Check,
  ChevronDown,
  Copy,
  Edit3,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json"
import type { AvailabilitySchedule } from "@/components/dashboard/availability-model"

interface AvailabilityScheduleControlsProps {
  schedules: AvailabilitySchedule[]
  selectedScheduleId: string
  timezone: string
}

interface ScheduleMutationResponse {
  schedule: AvailabilitySchedule
}

export function AvailabilityScheduleControls({
  schedules: initialSchedules,
  selectedScheduleId,
  timezone,
}: AvailabilityScheduleControlsProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [schedules, setSchedules] = useState<AvailabilitySchedule[]>(
    initialSchedules
  )
  const selectedSchedule = schedules.find(
    (schedule) => schedule.id === selectedScheduleId
  )
  const [newScheduleName, setNewScheduleName] = useState("")
  const [renameScheduleName, setRenameScheduleName] = useState(
    selectedSchedule?.name ?? ""
  )
  const [duplicateScheduleName, setDuplicateScheduleName] = useState(
    selectedSchedule ? `Copy of ${getScheduleDisplayName(selectedSchedule)}` : ""
  )
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)

  useEffect(() => {
    setSchedules(initialSchedules)
  }, [initialSchedules])

  useEffect(() => {
    const nextSelectedSchedule = initialSchedules.find(
      (schedule) => schedule.id === selectedScheduleId
    )
    setRenameScheduleName(nextSelectedSchedule?.name ?? "")
    setDuplicateScheduleName(
      nextSelectedSchedule
        ? `Copy of ${getScheduleDisplayName(nextSelectedSchedule)}`
        : ""
    )
  }, [initialSchedules, selectedScheduleId])

  function handleScheduleChange(scheduleId: string) {
    router.push(`/availability?scheduleId=${scheduleId}`)
    router.refresh()
  }

  function handleCreateDialogOpenChange(open: boolean) {
    setCreateDialogOpen(open)
    if (open) setNewScheduleName("")
  }

  function handleRenameDialogOpenChange(open: boolean) {
    setRenameDialogOpen(open)
    if (open) setRenameScheduleName(selectedSchedule?.name ?? "")
  }

  function handleDuplicateDialogOpenChange(open: boolean) {
    setDuplicateDialogOpen(open)
    if (open && selectedSchedule) {
      setDuplicateScheduleName(
        `Copy of ${getScheduleDisplayName(selectedSchedule)}`
      )
    }
  }

  async function handleCreateSchedule() {
    const name = newScheduleName.trim()
    if (!name) return

    setIsSavingSchedule(true)

    try {
      const { schedule } = await requestJson<ScheduleMutationResponse>(
        "/api/availability/schedules",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, timezone }),
        },
        "Failed to create schedule"
      )
      setNewScheduleName("")
      setCreateDialogOpen(false)
      toast({
        title: "Schedule created",
        description: `"${schedule.name}" is ready to edit.`,
      })
      router.push(`/availability?scheduleId=${schedule.id}`)
      router.refresh()
    } catch (error) {
      toast({
        title: "Could not create schedule",
        description: errorToastDescription(error),
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }

  async function handleRenameSchedule() {
    const name = renameScheduleName.trim()
    if (!selectedSchedule || !name || name === selectedSchedule.name) return

    setIsSavingSchedule(true)

    try {
      const { schedule: updatedSchedule } =
        await requestJson<ScheduleMutationResponse>(
          `/api/availability/schedules/${selectedSchedule.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          },
          "Failed to rename schedule"
        )

      setSchedules((current) =>
        current.map((schedule) =>
          schedule.id === selectedSchedule.id
            ? { ...schedule, name: updatedSchedule.name }
            : schedule
        )
      )
      toast({
        title: "Schedule renamed",
        description: `"${updatedSchedule.name}" has been updated.`,
      })
      setRenameDialogOpen(false)
      router.refresh()
    } catch (error) {
      toast({
        title: "Could not rename schedule",
        description: errorToastDescription(error),
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }

  async function handleDuplicateSchedule() {
    const name = duplicateScheduleName.trim()
    if (!selectedSchedule || !name) return

    setIsSavingSchedule(true)

    try {
      const { schedule } = await requestJson<ScheduleMutationResponse>(
        `/api/availability/schedules/${selectedSchedule.id}/duplicate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
        "Failed to duplicate schedule"
      )
      setDuplicateDialogOpen(false)
      toast({
        title: "Schedule duplicated",
        description: `"${schedule.name}" is ready to edit.`,
      })
      router.push(`/availability?scheduleId=${schedule.id}`)
      router.refresh()
    } catch (error) {
      toast({
        title: "Could not duplicate schedule",
        description: errorToastDescription(error),
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }

  async function handleSetDefaultSchedule() {
    if (!selectedSchedule || selectedSchedule.is_default) return

    setIsSavingSchedule(true)

    try {
      const { schedule } = await requestJson<ScheduleMutationResponse>(
        `/api/availability/schedules/${selectedSchedule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDefault: true }),
        },
        "Failed to set default schedule"
      )

      setSchedules((current) =>
        current.map((scheduleItem) => ({
          ...scheduleItem,
          is_default: scheduleItem.id === selectedSchedule.id,
        }))
      )
      toast({
        title: "Default schedule updated",
        description: `"${schedule.name}" is now the default for new event types.`,
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Could not update default schedule",
        description: errorToastDescription(error),
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }

  async function handleDeleteSchedule() {
    if (!selectedSchedule) return

    setIsSavingSchedule(true)

    try {
      await requestJson<Record<string, never>>(
        `/api/availability/schedules/${selectedSchedule.id}`,
        { method: "DELETE" },
        "Failed to delete schedule"
      )

      const remaining = schedules.filter(
        (schedule) => schedule.id !== selectedSchedule.id
      )
      const nextSchedule =
        remaining.find((schedule) => schedule.is_default) ?? remaining[0]

      toast({
        title: "Schedule deleted",
        description: `"${selectedSchedule.name}" has been removed.`,
      })
      setDeleteDialogOpen(false)

      if (nextSchedule) {
        router.push(`/availability?scheduleId=${nextSchedule.id}`)
      } else {
        router.push("/availability")
      }
      router.refresh()
    } catch (error) {
      toast({
        title: "Could not delete schedule",
        description: errorToastDescription(error),
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const assignedEventTypes = selectedSchedule?.assignedEventTypes ?? []
  const assignedEventTypeCount =
    selectedSchedule?.assignedEventTypeCount ?? assignedEventTypes.length
  const canDeleteSelectedSchedule =
    !!selectedSchedule &&
    !selectedSchedule.is_default &&
    assignedEventTypeCount === 0
  const deleteBlockedReason = selectedSchedule?.is_default
    ? "Default schedules cannot be deleted."
    : assignedEventTypeCount > 0
      ? "Schedules assigned to event types cannot be deleted."
      : null

  return (
    <>
      <section className="rounded-lg border border-border/80 bg-card shadow-sm shadow-slate-200/60">
        <div className="flex flex-col gap-6 px-6 py-7 md:flex-row md:items-start md:justify-between md:px-8">
          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-muted-foreground">
                Schedule
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Active schedule"
                    className="h-auto max-w-full justify-start gap-2 px-0 py-0 text-left text-2xl font-semibold leading-tight text-primary hover:bg-transparent hover:text-primary"
                  >
                    <span className="min-w-0 truncate">
                      {getScheduleLabel(selectedSchedule)}
                    </span>
                    <ChevronDown
                      className="h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[min(22rem,calc(100vw-2rem))] p-0"
                >
                  <DropdownMenuLabel className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                    Availability schedules
                  </DropdownMenuLabel>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {schedules.map((schedule) => {
                      const isSelected = schedule.id === selectedScheduleId

                      return (
                        <DropdownMenuItem
                          key={schedule.id}
                          onSelect={() => handleScheduleChange(schedule.id)}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <span className="min-w-0 truncate">
                            {getScheduleLabel(schedule)}
                          </span>
                          {isSelected ? (
                            <Check
                              className="h-4 w-4 shrink-0 text-primary"
                              aria-hidden="true"
                            />
                          ) : null}
                        </DropdownMenuItem>
                      )
                    })}
                  </div>
                  <DropdownMenuSeparator className="m-0" />
                  <DropdownMenuItem
                    onSelect={() => {
                      handleCreateDialogOpenChange(true)
                    }}
                    className="gap-2 px-4 py-3"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create schedule
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto justify-start gap-1.5 px-0 py-0 text-base hover:bg-transparent"
                >
                  <span className="font-semibold text-foreground">
                    Active on:
                  </span>
                  <span className="font-semibold text-primary">
                    {getEventTypeCountLabel(assignedEventTypeCount)}
                  </span>
                  <ChevronDown
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[min(20rem,calc(100vw-2rem))]"
              >
                <DropdownMenuLabel>Assigned event types</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {assignedEventTypes.length > 0 ? (
                  assignedEventTypes.map((eventType) => (
                    <DropdownMenuItem key={eventType.id} asChild>
                      <Link
                        href={`/event-types/${eventType.id}/edit`}
                        className="flex w-full flex-col items-start gap-0.5"
                      >
                        <span className="font-medium">{eventType.title}</span>
                        <span className="text-xs text-muted-foreground">
                          /{eventType.slug}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    No event types use this schedule.
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Schedule actions"
                className="h-9 w-9 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <MoreVertical className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {!selectedSchedule?.is_default ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => void handleSetDefaultSchedule()}
                    disabled={isSavingSchedule || !selectedSchedule}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Set as default
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem
                onSelect={() => handleRenameDialogOpenChange(true)}
                disabled={isSavingSchedule || !selectedSchedule}
                className="gap-2"
              >
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => handleDuplicateDialogOpenChange(true)}
                disabled={isSavingSchedule || !selectedSchedule}
                className="gap-2"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDeleteDialogOpen(true)}
                disabled={isSavingSchedule || !selectedSchedule}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
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
              value={newScheduleName}
              onChange={(event) => setNewScheduleName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCreateDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateSchedule}
              disabled={isSavingSchedule || !newScheduleName.trim()}
            >
              Create schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={handleRenameDialogOpenChange}>
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
              value={renameScheduleName}
              onChange={(event) => setRenameScheduleName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleRenameDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRenameSchedule}
              disabled={
                isSavingSchedule ||
                !renameScheduleName.trim() ||
                renameScheduleName.trim() === selectedSchedule?.name
              }
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={duplicateDialogOpen}
        onOpenChange={handleDuplicateDialogOpenChange}
      >
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
              value={duplicateScheduleName}
              onChange={(event) => setDuplicateScheduleName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDuplicateDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDuplicateSchedule}
              disabled={isSavingSchedule || !duplicateScheduleName.trim()}
            >
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete schedule</DialogTitle>
            <DialogDescription>
              {deleteBlockedReason ??
                `Delete "${selectedSchedule?.name}"? This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteSchedule}
              disabled={isSavingSchedule || !canDeleteSelectedSchedule}
            >
              Delete schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function getScheduleDisplayName(schedule: AvailabilitySchedule | undefined) {
  if (!schedule) return "Schedule"
  if (schedule.is_default && schedule.name === "Default schedule") {
    return "Working hours"
  }

  return schedule.name
}

function getScheduleLabel(schedule: AvailabilitySchedule | undefined) {
  if (!schedule) return "Schedule"
  const name = getScheduleDisplayName(schedule)
  return schedule.is_default ? `${name} (default)` : name
}

function getEventTypeCountLabel(count: number) {
  return `${count} event type${count === 1 ? "" : "s"}`
}
