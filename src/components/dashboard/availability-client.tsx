"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import {
  type TimeInterval,
  validateTimeInterval,
} from "@/components/dashboard/availability-day-row"
import { useToast } from "@/components/ui/use-toast"
import { AvailabilityOverridesCard } from "@/components/dashboard/availability-overrides-card"
import { AvailabilitySaveBar } from "@/components/dashboard/availability-save-bar"
import { AvailabilityScheduleControls } from "@/components/dashboard/availability-schedule-controls"
import { AvailabilityWeeklyHoursCard } from "@/components/dashboard/availability-weekly-hours-card"
import { useDashboardUnsavedChanges } from "@/components/dashboard/navigation-guard-provider"
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json"
import {
  buildAvailabilitySaveRequest,
  buildDayStates,
  hasAvailabilityChanges,
  normalizeSavedAvailability,
  type AvailabilityOverride,
  type AvailabilityRule,
  type AvailabilitySaveResponse,
  type AvailabilitySchedule,
  type DayState,
} from "@/components/dashboard/availability-model"

export interface AvailabilityClientProps {
  schedules: AvailabilitySchedule[]
  selectedScheduleId: string
  initialRules: AvailabilityRule[]
  initialOverrides: AvailabilityOverride[]
  initialScheduleUpdatedAt: string
  timezone: string
}

// Generate a temporary client-side ID for new items
function tempId(): string {
  return `temp_${crypto.randomUUID()}`
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
  initialScheduleUpdatedAt,
  timezone,
}: AvailabilityClientProps) {
  const { toast } = useToast()
  const selectedScheduleRef = useRef(selectedScheduleId)
  const scheduleVersionRef = useRef(initialScheduleUpdatedAt)

  // Track the "saved" baseline for diff computation
  const [savedRules, setSavedRules] = useState<AvailabilityRule[]>(initialRules)
  const [savedOverrides, setSavedOverrides] = useState<AvailabilityOverride[]>(initialOverrides)
  const [savedScheduleUpdatedAt, setSavedScheduleUpdatedAt] = useState(
    initialScheduleUpdatedAt
  )

  // Current editing state
  const [dayStates, setDayStates] = useState<Record<string, DayState>>(
    () => buildDayStates(initialRules)
  )
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>(initialOverrides)

  // Override form state
  const [newOverrideDate, setNewOverrideDate] = useState("")
  const [newOverrideAvailable, setNewOverrideAvailable] = useState(false)
  const [newOverrideStart, setNewOverrideStart] = useState("")
  const [newOverrideEnd, setNewOverrideEnd] = useState("")
  const [newOverrideReason, setNewOverrideReason] = useState("")

  // Saving state
  const [isSaving, setIsSaving] = useState(false)
  const newOverrideTimeError = useMemo(() => {
    if (!newOverrideAvailable) return ""
    if (!newOverrideStart || !newOverrideEnd) {
      return "Custom hours need a start and end time."
    }
    if (newOverrideStart >= newOverrideEnd) {
      return "End time must be after start time."
    }
    return ""
  }, [newOverrideAvailable, newOverrideEnd, newOverrideStart])
  const canAddOverride = Boolean(newOverrideDate) && !newOverrideTimeError
  const hasOverrideDraft = Boolean(
    newOverrideDate ||
      newOverrideAvailable ||
      newOverrideStart ||
      newOverrideEnd ||
      newOverrideReason
  )

  const hasChanges = useMemo(() => {
    return hasAvailabilityChanges({
      dayStates,
      overrides,
      savedRules,
      savedOverrides,
    })
  }, [dayStates, overrides, savedRules, savedOverrides])

  const weeklyTimeError = useMemo(() => {
    for (const state of Object.values(dayStates)) {
      if (!state.enabled) continue
      for (const interval of state.intervals) {
        if (validateTimeInterval(interval.start, interval.end)) {
          return "Fix invalid weekly hours before saving."
        }
      }
    }
    return ""
  }, [dayStates])

  useEffect(() => {
    const scheduleChanged = selectedScheduleRef.current !== selectedScheduleId
    const serverVersionChanged =
      scheduleVersionRef.current !== initialScheduleUpdatedAt

    if (
      !scheduleChanged &&
      (!serverVersionChanged || hasChanges || hasOverrideDraft)
    ) {
      return
    }

    selectedScheduleRef.current = selectedScheduleId
    scheduleVersionRef.current = initialScheduleUpdatedAt
    setSavedRules(initialRules)
    setSavedOverrides(initialOverrides)
    setDayStates(buildDayStates(initialRules))
    setOverrides(initialOverrides)
    setSavedScheduleUpdatedAt(initialScheduleUpdatedAt)
    setNewOverrideDate("")
    setNewOverrideAvailable(false)
    setNewOverrideStart("")
    setNewOverrideEnd("")
    setNewOverrideReason("")
  }, [
    hasChanges,
    hasOverrideDraft,
    initialRules,
    initialOverrides,
    initialScheduleUpdatedAt,
    selectedScheduleId,
  ])

  const handleDiscard = useCallback(() => {
    setDayStates(buildDayStates(savedRules))
    setOverrides([...savedOverrides])
    setNewOverrideDate("")
    setNewOverrideAvailable(false)
    setNewOverrideStart("")
    setNewOverrideEnd("")
    setNewOverrideReason("")
  }, [savedRules, savedOverrides])

  useDashboardUnsavedChanges(
    `availability-editor-${selectedScheduleId}`,
    hasChanges || hasOverrideDraft,
    handleDiscard
  )

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
        // Preserve IDs for existing intervals, assign temp IDs for new ones
        const updatedIntervals = intervals.map((interval) => ({
          id: interval.id ?? tempId(),
          start: interval.start,
          end: interval.end,
        }))

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
    if (!canAddOverride) return

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
  }, [
    canAddOverride,
    newOverrideDate,
    newOverrideAvailable,
    newOverrideStart,
    newOverrideEnd,
    newOverrideReason,
  ])

  const handleRemoveOverride = useCallback((id: string) => {
    setOverrides((prev) => prev.filter((o) => o.id !== id))
  }, [])

  // --- Save logic ---

  const handleSave = useCallback(async () => {
    if (weeklyTimeError) {
      toast({
        title: "Fix weekly hours",
        description: weeklyTimeError,
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      const { currentRules, payload } = buildAvailabilitySaveRequest({
        dayStates,
        overrides,
        savedRules,
        savedOverrides,
        selectedScheduleId,
        expectedScheduleUpdatedAt: savedScheduleUpdatedAt,
        timezone,
      })
      const savedData = await requestJson<AvailabilitySaveResponse>(
        "/api/availability",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        "Failed to save availability"
      )
      const { rules: nextRules, overrides: nextOverrides } =
        normalizeSavedAvailability({
          savedData,
          currentRules,
          currentOverrides: overrides,
          createTempId: tempId,
        })

      if (!savedData.scheduleUpdatedAt) {
        throw new Error(
          'Availability was saved without a new version. Reload and retry.'
        )
      }

      setSavedRules(nextRules)
      setSavedOverrides(nextOverrides)
      setSavedScheduleUpdatedAt(savedData.scheduleUpdatedAt)
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
        description: errorToastDescription(error),
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
    savedScheduleUpdatedAt,
    timezone,
    toast,
    weeklyTimeError,
  ])

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Availability</h1>

      <AvailabilityScheduleControls
        schedules={initialSchedules}
        selectedScheduleId={selectedScheduleId}
        timezone={timezone}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AvailabilityWeeklyHoursCard
          dayStates={dayStates}
          timezone={timezone}
          onToggleDay={handleToggle}
          onIntervalsChange={handleIntervalsChange}
        />

        <AvailabilityOverridesCard
          overrides={overrides}
          newOverrideDate={newOverrideDate}
          newOverrideAvailable={newOverrideAvailable}
          newOverrideStart={newOverrideStart}
          newOverrideEnd={newOverrideEnd}
          newOverrideReason={newOverrideReason}
          newOverrideTimeError={newOverrideTimeError}
          canAddOverride={canAddOverride}
          onAddOverride={handleAddOverride}
          onRemoveOverride={handleRemoveOverride}
          onNewOverrideDateChange={setNewOverrideDate}
          onNewOverrideAvailableChange={setNewOverrideAvailable}
          onNewOverrideStartChange={setNewOverrideStart}
          onNewOverrideEndChange={setNewOverrideEnd}
          onNewOverrideReasonChange={setNewOverrideReason}
        />
      </div>

      {hasChanges && (
        <AvailabilitySaveBar
          isSaving={isSaving}
          saveBlockedReason={weeklyTimeError}
          onDiscard={handleDiscard}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
