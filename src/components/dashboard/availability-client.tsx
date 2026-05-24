"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  CalendarDays,
  Clock,
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
import { AvailabilityScheduleControls } from "@/components/dashboard/availability-schedule-controls"
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json"
import {
  DAYS,
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
  timezone,
}: AvailabilityClientProps) {
  const { toast } = useToast()

  // Track the "saved" baseline for diff computation
  const [savedRules, setSavedRules] = useState<AvailabilityRule[]>(initialRules)
  const [savedOverrides, setSavedOverrides] = useState<AvailabilityOverride[]>(initialOverrides)

  // Current editing state
  const [dayStates, setDayStates] = useState<Record<string, DayState>>(
    () => buildDayStates(initialRules)
  )
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>(initialOverrides)

  useEffect(() => {
    setSavedRules(initialRules)
    setSavedOverrides(initialOverrides)
    setDayStates(buildDayStates(initialRules))
    setOverrides(initialOverrides)
  }, [initialRules, initialOverrides])

  // Override form state
  const [newOverrideDate, setNewOverrideDate] = useState("")
  const [newOverrideAvailable, setNewOverrideAvailable] = useState(false)
  const [newOverrideStart, setNewOverrideStart] = useState("")
  const [newOverrideEnd, setNewOverrideEnd] = useState("")
  const [newOverrideReason, setNewOverrideReason] = useState("")

  // Saving state
  const [isSaving, setIsSaving] = useState(false)

  const hasChanges = useMemo(() => {
    return hasAvailabilityChanges({
      dayStates,
      overrides,
      savedRules,
      savedOverrides,
    })
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

  // --- Save logic ---

  const handleSave = useCallback(async () => {
    setIsSaving(true)

    try {
      const { currentRules, payload } = buildAvailabilitySaveRequest({
        dayStates,
        overrides,
        savedRules,
        savedOverrides,
        selectedScheduleId,
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
    timezone,
    toast,
  ])

  const handleDiscard = useCallback(() => {
    setDayStates(buildDayStates(savedRules))
    setOverrides([...savedOverrides])
  }, [savedRules, savedOverrides])

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Availability</h1>

      <AvailabilityScheduleControls
        schedules={initialSchedules}
        selectedScheduleId={selectedScheduleId}
        timezone={timezone}
      />

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
                  id: interval.id,
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
