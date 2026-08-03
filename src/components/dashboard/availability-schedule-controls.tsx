"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CreateScheduleDialog,
  DeleteScheduleDialog,
  DuplicateScheduleDialog,
  RenameScheduleDialog,
} from "@/components/dashboard/availability-schedule-dialogs"
import {
  AssignedEventTypesMenu,
  ScheduleActionsMenu,
  SchedulePickerMenu,
} from "@/components/dashboard/availability-schedule-menus"
import { useToast } from "@/components/ui/use-toast"
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json"
import type { AvailabilitySchedule } from "@/components/dashboard/availability-model"
import { getScheduleDisplayName } from "@/components/dashboard/availability-schedule-controls-utils"
import { useDashboardNavigationGuard } from "@/components/dashboard/navigation-guard-provider"

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
  const { requestNavigation } = useDashboardNavigationGuard()
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
    if (scheduleId === selectedScheduleId) return

    requestNavigation(() => {
      router.push(`/availability?scheduleId=${scheduleId}`)
    })
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

  async function runScheduleMutation(
    errorTitle: string,
    action: () => Promise<void>
  ) {
    setIsSavingSchedule(true)

    try {
      await action()
    } catch (error) {
      toast({
        title: errorTitle,
        description: errorToastDescription(error),
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }

  function handleCreateSchedule() {
    const name = newScheduleName.trim()
    if (!name) return

    requestNavigation(() => {
      void createSchedule(name)
    })
  }

  async function createSchedule(name: string) {
    await runScheduleMutation("Could not create schedule", async () => {
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
    })
  }

  async function handleRenameSchedule() {
    const name = renameScheduleName.trim()
    if (!selectedSchedule || !name || name === selectedSchedule.name) return

    await runScheduleMutation("Could not rename schedule", async () => {
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
    })
  }

  function handleDuplicateSchedule() {
    const name = duplicateScheduleName.trim()
    if (!selectedSchedule || !name) return

    requestNavigation(() => {
      void duplicateSchedule(selectedSchedule.id, name)
    })
  }

  async function duplicateSchedule(scheduleId: string, name: string) {
    await runScheduleMutation("Could not duplicate schedule", async () => {
      const { schedule } = await requestJson<ScheduleMutationResponse>(
        `/api/availability/schedules/${scheduleId}/duplicate`,
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
    })
  }

  async function handleSetDefaultSchedule() {
    if (!selectedSchedule || selectedSchedule.is_default) return

    await runScheduleMutation("Could not update default schedule", async () => {
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
    })
  }

  function handleDeleteSchedule() {
    if (!selectedSchedule) return

    requestNavigation(() => {
      void deleteSchedule(selectedSchedule)
    })
  }

  async function deleteSchedule(scheduleToDelete: AvailabilitySchedule) {
    await runScheduleMutation("Could not delete schedule", async () => {
      await requestJson<Record<string, never>>(
        `/api/availability/schedules/${scheduleToDelete.id}`,
        { method: "DELETE" },
        "Failed to delete schedule"
      )

      const remaining = schedules.filter(
        (schedule) => schedule.id !== scheduleToDelete.id
      )
      const nextSchedule =
        remaining.find((schedule) => schedule.is_default) ?? remaining[0]

      toast({
        title: "Schedule deleted",
        description: `"${scheduleToDelete.name}" has been removed.`,
      })
      setDeleteDialogOpen(false)

      if (nextSchedule) {
        router.push(`/availability?scheduleId=${nextSchedule.id}`)
      } else {
        router.push("/availability")
      }
    })
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
              <SchedulePickerMenu
                schedules={schedules}
                selectedSchedule={selectedSchedule}
                selectedScheduleId={selectedScheduleId}
                onScheduleChange={handleScheduleChange}
                onCreateSchedule={() => handleCreateDialogOpenChange(true)}
              />
            </div>

            <AssignedEventTypesMenu
              assignedEventTypes={assignedEventTypes}
              assignedEventTypeCount={assignedEventTypeCount}
            />
          </div>

          <ScheduleActionsMenu
            selectedSchedule={selectedSchedule}
            isSavingSchedule={isSavingSchedule}
            onSetDefaultSchedule={handleSetDefaultSchedule}
            onRenameSchedule={() => handleRenameDialogOpenChange(true)}
            onDuplicateSchedule={() => handleDuplicateDialogOpenChange(true)}
            onDeleteSchedule={() => setDeleteDialogOpen(true)}
          />
        </div>
      </section>

      <CreateScheduleDialog
        open={createDialogOpen}
        name={newScheduleName}
        isSavingSchedule={isSavingSchedule}
        onOpenChange={handleCreateDialogOpenChange}
        onNameChange={setNewScheduleName}
        onSubmit={handleCreateSchedule}
      />

      <RenameScheduleDialog
        open={renameDialogOpen}
        name={renameScheduleName}
        originalName={selectedSchedule?.name}
        isSavingSchedule={isSavingSchedule}
        onOpenChange={handleRenameDialogOpenChange}
        onNameChange={setRenameScheduleName}
        onSubmit={handleRenameSchedule}
      />

      <DuplicateScheduleDialog
        open={duplicateDialogOpen}
        name={duplicateScheduleName}
        isSavingSchedule={isSavingSchedule}
        onOpenChange={handleDuplicateDialogOpenChange}
        onNameChange={setDuplicateScheduleName}
        onSubmit={handleDuplicateSchedule}
      />

      <DeleteScheduleDialog
        open={deleteDialogOpen}
        scheduleName={selectedSchedule?.name}
        deleteBlockedReason={deleteBlockedReason}
        isSavingSchedule={isSavingSchedule}
        canDeleteSelectedSchedule={canDeleteSelectedSchedule}
        onOpenChange={setDeleteDialogOpen}
        onSubmit={handleDeleteSchedule}
      />
    </>
  )
}
