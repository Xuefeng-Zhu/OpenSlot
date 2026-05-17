"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Edit3,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react"
import {
  AvailabilityDayRow,
  type TimeInterval,
} from "@/components/dashboard/availability-day-row"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { useToast } from "@/components/ui/use-toast"
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

// --- Types ---

interface AvailabilityRule {
  id: string
  weekday: number
  start_time: string
  end_time: string
  is_active: boolean
}

interface AvailabilityOverride {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  is_available: boolean
  reason: string | null
}

interface AssignedEventTypeSummary {
  id: string
  title: string
  slug: string
}

export interface AvailabilitySchedule {
  id: string
  name: string
  timezone: string
  is_default: boolean
  assignedEventTypes: AssignedEventTypeSummary[]
  assignedEventTypeCount: number
}

export interface AvailabilityClientProps {
  schedules: AvailabilitySchedule[]
  selectedScheduleId: string
  initialRules: AvailabilityRule[]
  initialOverrides: AvailabilityOverride[]
  timezone: string
  userId: string
}

// --- Helpers ---

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

/**
 * Maps weekday index (0=Sunday, 1=Monday, ..., 6=Saturday) from the DB
 * to our DAYS array index (0=Monday, ..., 6=Sunday).
 * DB uses 0=Sunday, 1=Monday, ..., 6=Saturday.
 * Our DAYS array uses 0=Monday, ..., 6=Sunday.
 */
function dbWeekdayToDayIndex(dbWeekday: number): number {
  // DB: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // UI: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  return dbWeekday === 0 ? 6 : dbWeekday - 1
}

function dayIndexToDbWeekday(dayIndex: number): number {
  // UI: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  // DB: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  return dayIndex === 6 ? 0 : dayIndex + 1
}

interface DayState {
  enabled: boolean
  intervals: Array<{ id?: string; start: string; end: string }>
}

/**
 * Converts database availability rules into the Monday-first editor state.
 * Rule ids are preserved so later saves can distinguish updates/deletes from
 * newly added intervals.
 */
function buildDayStates(rules: AvailabilityRule[]): Record<string, DayState> {
  const states: Record<string, DayState> = {}
  for (const day of DAYS) {
    states[day] = { enabled: false, intervals: [] }
  }

  for (const rule of rules) {
    const dayIndex = dbWeekdayToDayIndex(rule.weekday)
    const dayName = DAYS[dayIndex]
    if (dayName) {
      states[dayName].enabled = states[dayName].enabled || rule.is_active
      states[dayName].intervals.push({
        id: rule.id,
        start: rule.start_time,
        end: rule.end_time,
      })
    }
  }

  // If a day has intervals, mark it as enabled
  for (const day of DAYS) {
    if (states[day].intervals.length > 0) {
      states[day].enabled = true
    }
  }

  return states
}

// Generate a temporary client-side ID for new items
function tempId(): string {
  return `temp_${crypto.randomUUID()}`
}

function toTimeInputValue(time: string | null): string | null {
  return time ? time.slice(0, 5) : null
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

// --- Component ---

/**
 * Client-side availability editor for weekly rules and date overrides.
 * Keeps a saved baseline in state so the save request can send changed rows and
 * deletion ids without refetching after every edit.
 */
export function AvailabilityClient({
  schedules: initialSchedules,
  selectedScheduleId,
  initialRules,
  initialOverrides,
  timezone,
}: AvailabilityClientProps) {
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

  // Track the "saved" baseline for diff computation
  const [savedRules, setSavedRules] = useState<AvailabilityRule[]>(initialRules)
  const [savedOverrides, setSavedOverrides] = useState<AvailabilityOverride[]>(initialOverrides)

  // Current editing state
  const [dayStates, setDayStates] = useState<Record<string, DayState>>(
    () => buildDayStates(initialRules)
  )
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>(initialOverrides)

  useEffect(() => {
    setSchedules(initialSchedules)
  }, [initialSchedules])

  useEffect(() => {
    setSavedRules(initialRules)
    setSavedOverrides(initialOverrides)
    setDayStates(buildDayStates(initialRules))
    setOverrides(initialOverrides)
    setRenameScheduleName(
      initialSchedules.find((schedule) => schedule.id === selectedScheduleId)
        ?.name ?? ""
    )
    const nextSelectedSchedule = initialSchedules.find(
      (schedule) => schedule.id === selectedScheduleId
    )
    setDuplicateScheduleName(
      nextSelectedSchedule
        ? `Copy of ${getScheduleDisplayName(nextSelectedSchedule)}`
        : ""
    )
  }, [initialRules, initialOverrides, initialSchedules, selectedScheduleId])

  // Override form state
  const [newOverrideDate, setNewOverrideDate] = useState("")
  const [newOverrideAvailable, setNewOverrideAvailable] = useState(false)
  const [newOverrideStart, setNewOverrideStart] = useState("")
  const [newOverrideEnd, setNewOverrideEnd] = useState("")
  const [newOverrideReason, setNewOverrideReason] = useState("")

  // Saving state
  const [isSaving, setIsSaving] = useState(false)

  // Detect changes by comparing current state to saved state
  const hasChanges = useMemo(() => {
    // Check rules changes
    const currentRules = flattenDayStatesToRules(dayStates)
    if (currentRules.length !== savedRules.length) return true

    // Compare each rule
    for (const saved of savedRules) {
      const dayIndex = dbWeekdayToDayIndex(saved.weekday)
      const dayName = DAYS[dayIndex]
      const dayState = dayStates[dayName]
      if (!dayState) return true

      const matchingInterval = dayState.intervals.find((i) => i.id === saved.id)
      if (!matchingInterval) return true
      if (
        matchingInterval.start !== saved.start_time ||
        matchingInterval.end !== saved.end_time
      ) {
        return true
      }
      // Check if enabled state changed
      if (!dayState.enabled && saved.is_active) return true
    }

    // Check for new intervals (no id or temp id)
    for (const day of DAYS) {
      const state = dayStates[day]
      if (state.enabled) {
        for (const interval of state.intervals) {
          if (!interval.id || interval.id.startsWith("temp_")) return true
        }
      }
    }

    // Check overrides changes
    if (overrides.length !== savedOverrides.length) return true
    for (let i = 0; i < overrides.length; i++) {
      const curr = overrides[i]
      const saved = savedOverrides.find((o) => o.id === curr.id)
      if (!saved) return true
      if (
        curr.date !== saved.date ||
        curr.start_time !== saved.start_time ||
        curr.end_time !== saved.end_time ||
        curr.is_available !== saved.is_available ||
        curr.reason !== saved.reason
      ) {
        return true
      }
    }

    return false
  }, [dayStates, overrides, savedRules, savedOverrides])

  // --- Day row handlers ---

  const handleToggle = useCallback((day: string, enabled: boolean) => {
    setDayStates((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled },
    }))
  }, [])

  const handleIntervalsChange = useCallback(
    (day: string, intervals: TimeInterval[]) => {
      setDayStates((prev) => {
        const existing = prev[day]
        // Preserve IDs for existing intervals, assign temp IDs for new ones
        const updatedIntervals = intervals.map((interval, idx) => {
          const existingInterval = existing.intervals[idx]
          return {
            id: existingInterval?.id,
            start: interval.start,
            end: interval.end,
          }
        })

        // If new intervals were added (more than before), assign temp IDs
        for (let i = existing.intervals.length; i < updatedIntervals.length; i++) {
          if (!updatedIntervals[i].id) {
            updatedIntervals[i] = { ...updatedIntervals[i], id: tempId() }
          }
        }

        return {
          ...prev,
          [day]: { ...prev[day], intervals: updatedIntervals },
        }
      })
    },
    []
  )

  // --- Override handlers ---

  const handleAddOverride = useCallback(() => {
    if (!newOverrideDate) return

    // Validate times if marking as available
    if (newOverrideAvailable && (!newOverrideStart || !newOverrideEnd)) return
    if (newOverrideAvailable && newOverrideStart >= newOverrideEnd) return

    const newOverride: AvailabilityOverride = {
      id: tempId(),
      date: newOverrideDate,
      start_time: newOverrideAvailable ? newOverrideStart : null,
      end_time: newOverrideAvailable ? newOverrideEnd : null,
      is_available: newOverrideAvailable,
      reason: newOverrideReason || null,
    }

    setOverrides((prev) => [...prev, newOverride])
    setNewOverrideDate("")
    setNewOverrideAvailable(false)
    setNewOverrideStart("")
    setNewOverrideEnd("")
    setNewOverrideReason("")
  }, [newOverrideDate, newOverrideAvailable, newOverrideStart, newOverrideEnd, newOverrideReason])

  const handleRemoveOverride = useCallback((id: string) => {
    setOverrides((prev) => prev.filter((o) => o.id !== id))
  }, [])

  const handleScheduleChange = useCallback(
    (scheduleId: string) => {
      router.push(`/availability?scheduleId=${scheduleId}`)
      router.refresh()
    },
    [router]
  )

  const handleCreateDialogOpenChange = useCallback((open: boolean) => {
    setCreateDialogOpen(open)
    if (open) setNewScheduleName("")
  }, [setCreateDialogOpen, setNewScheduleName])

  const handleRenameDialogOpenChange = useCallback(
    (open: boolean) => {
      setRenameDialogOpen(open)
      if (open) setRenameScheduleName(selectedSchedule?.name ?? "")
    },
    [selectedSchedule, setRenameDialogOpen, setRenameScheduleName]
  )

  const handleDuplicateDialogOpenChange = useCallback(
    (open: boolean) => {
      setDuplicateDialogOpen(open)
      if (open && selectedSchedule) {
        setDuplicateScheduleName(
          `Copy of ${getScheduleDisplayName(selectedSchedule)}`
        )
      }
    },
    [selectedSchedule, setDuplicateDialogOpen, setDuplicateScheduleName]
  )

  const handleCreateSchedule = useCallback(async () => {
    const name = newScheduleName.trim()
    if (!name) return

    setIsSavingSchedule(true)

    try {
      const response = await fetch("/api/availability/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || "Failed to create schedule")
      }

      const schedule = result.schedule as AvailabilitySchedule
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
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }, [
    newScheduleName,
    router,
    setCreateDialogOpen,
    setIsSavingSchedule,
    setNewScheduleName,
    timezone,
    toast,
  ])

  const handleRenameSchedule = useCallback(async () => {
    const name = renameScheduleName.trim()
    if (!selectedSchedule || !name || name === selectedSchedule.name) return

    setIsSavingSchedule(true)

    try {
      const response = await fetch(
        `/api/availability/schedules/${selectedSchedule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      )
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || "Failed to rename schedule")
      }

      setSchedules((current) =>
        current.map((schedule) =>
          schedule.id === selectedSchedule.id
            ? { ...schedule, name: result.schedule.name }
            : schedule
        )
      )
      toast({
        title: "Schedule renamed",
        description: `"${result.schedule.name}" has been updated.`,
      })
      setRenameDialogOpen(false)
      router.refresh()
    } catch (error) {
      toast({
        title: "Could not rename schedule",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }, [
    renameScheduleName,
    router,
    selectedSchedule,
    setIsSavingSchedule,
    setRenameDialogOpen,
    setSchedules,
    toast,
  ])

  const handleDuplicateSchedule = useCallback(async () => {
    const name = duplicateScheduleName.trim()
    if (!selectedSchedule || !name) return

    setIsSavingSchedule(true)

    try {
      const response = await fetch(
        `/api/availability/schedules/${selectedSchedule.id}/duplicate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      )
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || "Failed to duplicate schedule")
      }

      const schedule = result.schedule as AvailabilitySchedule
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
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }, [
    duplicateScheduleName,
    router,
    selectedSchedule,
    setDuplicateDialogOpen,
    setIsSavingSchedule,
    toast,
  ])

  const handleSetDefaultSchedule = useCallback(async () => {
    if (!selectedSchedule || selectedSchedule.is_default) return

    setIsSavingSchedule(true)

    try {
      const response = await fetch(
        `/api/availability/schedules/${selectedSchedule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDefault: true }),
        }
      )
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || "Failed to set default schedule")
      }

      setSchedules((current) =>
        current.map((schedule) => ({
          ...schedule,
          is_default: schedule.id === selectedSchedule.id,
        }))
      )
      toast({
        title: "Default schedule updated",
        description: `"${result.schedule.name}" is now the default for new event types.`,
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Could not update default schedule",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }, [
    router,
    selectedSchedule,
    setIsSavingSchedule,
    setSchedules,
    toast,
  ])

  const handleDeleteSchedule = useCallback(async () => {
    if (!selectedSchedule) return

    setIsSavingSchedule(true)

    try {
      const response = await fetch(
        `/api/availability/schedules/${selectedSchedule.id}`,
        { method: "DELETE" }
      )
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete schedule")
      }

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
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }, [
    router,
    schedules,
    selectedSchedule,
    setDeleteDialogOpen,
    setIsSavingSchedule,
    toast,
  ])

  // --- Save logic ---

  const handleSave = useCallback(async () => {
    setIsSaving(true)

    try {
      // Compute diff for rules
      const currentRules = flattenDayStatesToRules(dayStates)
      const currentRuleIds = new Set(
        currentRules.filter((r) => !r.id?.startsWith("temp_")).map((r) => r.id)
      )

      // Deleted rules: in saved but not in current
      const deletedRuleIds = savedRules
        .filter((r) => !currentRuleIds.has(r.id))
        .map((r) => r.id)

      // Rules to send: new (temp id or no id) and updated (existing id)
      const rulesToSend = currentRules.map((r) => {
        if (r.id?.startsWith("temp_")) {
          // New rule - don't send id
          return {
            weekday: r.weekday,
            start_time: r.start_time,
            end_time: r.end_time,
            is_active: r.is_active,
          }
        }
        // Existing rule - send id for update
        return {
          id: r.id,
          weekday: r.weekday,
          start_time: r.start_time,
          end_time: r.end_time,
          is_active: r.is_active,
        }
      })

      // Compute diff for overrides
      const currentOverrideIds = new Set(
        overrides.filter((o) => !o.id.startsWith("temp_")).map((o) => o.id)
      )

      // Deleted overrides: in saved but not in current
      const deletedOverrideIds = savedOverrides
        .filter((o) => !currentOverrideIds.has(o.id))
        .map((o) => o.id)

      // Overrides to send
      const overridesToSend = overrides.map((o) => {
        if (o.id.startsWith("temp_")) {
          return {
            date: o.date,
            start_time: o.start_time,
            end_time: o.end_time,
            is_available: o.is_available,
            reason: o.reason,
          }
        }
        return {
          id: o.id,
          date: o.date,
          start_time: o.start_time,
          end_time: o.end_time,
          is_available: o.is_available,
          reason: o.reason,
        }
      })

      const response = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: selectedScheduleId,
          rules: rulesToSend,
          overrides: overridesToSend,
          deletedRuleIds,
          deletedOverrideIds,
          timezone,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save availability")
      }

      const savedData = (await response.json().catch(() => null)) as {
        rules?: AvailabilityRule[]
        overrides?: AvailabilityOverride[]
      } | null
      const nextRules = (savedData?.rules ?? currentRules).map((rule) => ({
        id: rule.id || tempId(),
        weekday: rule.weekday,
        start_time: toTimeInputValue(rule.start_time) ?? "",
        end_time: toTimeInputValue(rule.end_time) ?? "",
        is_active: rule.is_active,
      }))
      const nextOverrides = (savedData?.overrides ?? overrides).map(
        (override) => ({
          id: override.id,
          date: override.date,
          start_time: toTimeInputValue(override.start_time),
          end_time: toTimeInputValue(override.end_time),
          is_available: override.is_available,
          reason: override.reason,
        })
      )

      setSavedRules(nextRules)
      setSavedOverrides(nextOverrides)
      setDayStates(buildDayStates(nextRules))
      setOverrides(nextOverrides)

      toast({
        title: "Availability saved",
        description: "Your availability settings have been updated successfully.",
      })
    } catch (error) {
      // On error, preserve form state so user can retry
      toast({
        title: "Error saving availability",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [
    dayStates,
    overrides,
    savedRules,
    savedOverrides,
    selectedScheduleId,
    timezone,
    toast,
  ])

  const handleDiscard = useCallback(() => {
    setDayStates(buildDayStates(savedRules))
    setOverrides([...savedOverrides])
  }, [savedRules, savedOverrides])

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
    <div className="space-y-6">
      <h1 className="sr-only">Availability</h1>

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-base">Weekly hours</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Set when you are typically available for meetings
              </p>
            </div>
            <div className="flex w-fit items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{timezone.replace(/_/g, " ")}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {DAYS.map((day) => (
              <AvailabilityDayRow
                key={day}
                day={day}
                enabled={dayStates[day].enabled}
                intervals={dayStates[day].intervals.map((interval) => ({
                  start: interval.start,
                  end: interval.end,
                }))}
                onToggle={(enabled) => handleToggle(day, enabled)}
                onIntervalsChange={(intervals) =>
                  handleIntervalsChange(day, intervals)
                }
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-base">
                  Date-specific hours
                </CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Adjust hours for specific days
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddOverride}
              disabled={!newOverrideDate}
              aria-label="Add override"
              className="w-fit rounded-full px-4"
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              Hours
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-md border p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="override-date" className="text-xs">
                    Date
                  </Label>
                  <Input
                    id="override-date"
                    type="date"
                    value={newOverrideDate}
                    onChange={(event) => setNewOverrideDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <div className="flex h-10 items-center gap-2">
                    <input
                      id="override-available"
                      type="checkbox"
                      checked={newOverrideAvailable}
                      onChange={(event) =>
                        setNewOverrideAvailable(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="override-available" className="text-sm">
                      Custom hours
                    </Label>
                  </div>
                </div>
                {newOverrideAvailable && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="override-start" className="text-xs">
                        Start
                      </Label>
                      <Input
                        id="override-start"
                        type="time"
                        value={newOverrideStart}
                        onChange={(event) =>
                          setNewOverrideStart(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="override-end" className="text-xs">
                        End
                      </Label>
                      <Input
                        id="override-end"
                        type="time"
                        value={newOverrideEnd}
                        onChange={(event) =>
                          setNewOverrideEnd(event.target.value)
                        }
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="override-reason" className="text-xs">
                  Reason (optional)
                </Label>
                <Input
                  id="override-reason"
                  placeholder="e.g. Holiday, Doctor appointment"
                  value={newOverrideReason}
                  onChange={(event) => setNewOverrideReason(event.target.value)}
                />
              </div>
            </div>

            {overrides.length > 0 ? (
              <ul className="space-y-2" aria-label="Date-specific hours">
                {overrides.map((override) => (
                  <li
                    key={override.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center rounded bg-accent px-2 py-1 text-center">
                        <span className="text-[10px] font-medium uppercase text-primary">
                          {new Date(
                            override.date + "T00:00:00"
                          ).toLocaleDateString(undefined, { month: "short" })}
                        </span>
                        <span className="text-lg font-bold leading-none text-foreground">
                          {new Date(override.date + "T00:00:00").getDate()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(
                            override.date + "T00:00:00"
                          ).toLocaleDateString(undefined, {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <Badge
                          variant={override.is_available ? "outline" : "secondary"}
                          className="mt-0.5"
                        >
                          {override.is_available ? "Custom hours" : "Unavailable"}
                        </Badge>
                        {override.is_available &&
                          override.start_time &&
                          override.end_time && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {override.start_time} - {override.end_time}
                            </p>
                          )}
                        {override.reason && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {override.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemoveOverride(override.id)}
                      aria-label={`Remove override for ${override.date}`}
                    >
                      <Trash2
                        className="h-3.5 w-3.5 text-destructive"
                        aria-hidden="true"
                      />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
                heading="No date-specific hours"
                description="Your weekly schedule applies every week. Add custom hours when a specific date needs a different window or should be unavailable."
                className="bg-muted/30 py-10"
              />
            )}
          </CardContent>
        </Card>
      </div>

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

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-3 border-t border-border bg-card px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-2 sm:items-center">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning sm:mt-0"
              aria-hidden="true"
            />
            <div className="text-sm">
              <span className="font-medium text-foreground">
                You have unsaved changes.
              </span>{" "}
              <span className="text-muted-foreground">
                Save before leaving this page.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:shrink-0">
            <Button variant="outline" onClick={handleDiscard} disabled={isSaving}>
              Discard
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save availability"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Utility: flatten day states back to rule-like objects for diff ---

/**
 * Converts the editor's Monday-first day state back to database-shaped rules.
 * Disabled days still emit their intervals with is_active=false so existing rows
 * can be updated rather than silently dropped.
 */
function flattenDayStatesToRules(
  dayStates: Record<string, DayState>
): Array<{
  id?: string
  weekday: number
  start_time: string
  end_time: string
  is_active: boolean
}> {
  const rules: Array<{
    id?: string
    weekday: number
    start_time: string
    end_time: string
    is_active: boolean
  }> = []

  for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
    const day = DAYS[dayIndex]
    const state = dayStates[day]
    if (!state) continue

    const dbWeekday = dayIndexToDbWeekday(dayIndex)

    for (const interval of state.intervals) {
      if (interval.start && interval.end) {
        rules.push({
          id: interval.id,
          weekday: dbWeekday,
          start_time: interval.start,
          end_time: interval.end,
          is_active: state.enabled,
        })
      }
    }
  }

  return rules
}
