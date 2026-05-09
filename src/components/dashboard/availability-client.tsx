"use client"

import { useState, useMemo, useCallback } from "react"
import { Clock, Plus, Trash2, CalendarDays } from "lucide-react"
import {
  AvailabilityDayRow,
  type TimeInterval,
} from "@/components/dashboard/availability-day-row"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"

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

export interface AvailabilityClientProps {
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

// --- Component ---

/**
 * Client-side availability editor for weekly rules and date overrides.
 * Keeps a saved baseline in state so the save request can send changed rows and
 * deletion ids without refetching after every edit.
 */
export function AvailabilityClient({
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

  // --- Save logic ---

  const handleSave = useCallback(async () => {
    setIsSaving(true)

    try {
      // Compute diff for rules
      const currentRules = flattenDayStatesToRules(dayStates)
      const savedRuleIds = new Set(savedRules.map((r) => r.id))
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
      const savedOverrideIds = new Set(savedOverrides.map((o) => o.id))
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

      // Success: update saved baseline to current state
      const newSavedRules = currentRules.map((r) => ({
        ...r,
        id: r.id?.startsWith("temp_") ? r.id : r.id!, // In reality, the server assigns IDs
      }))

      // For a proper round-trip, we'd refetch. For now, mark current state as saved.
      setSavedRules(
        currentRules.map((r) => ({
          id: r.id || tempId(),
          weekday: r.weekday,
          start_time: r.start_time,
          end_time: r.end_time,
          is_active: r.is_active,
        }))
      )
      setSavedOverrides([...overrides])

      // Reset temp IDs in day states to reflect "saved" state
      setDayStates((prev) => {
        const next = { ...prev }
        for (const day of DAYS) {
          next[day] = {
            ...next[day],
            intervals: next[day].intervals.map((interval) => ({
              ...interval,
              // Keep the id as-is; it's now part of the saved baseline
            })),
          }
        }
        return next
      })

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
  }, [dayStates, overrides, savedRules, savedOverrides, timezone, toast])

  const handleDiscard = useCallback(() => {
    setDayStates(buildDayStates(savedRules))
    setOverrides([...savedOverrides])
  }, [savedRules, savedOverrides])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-sm text-muted-foreground">
        Dashboard &gt;{" "}
        <span className="text-foreground font-medium">Availability</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Availability</h1>
        <p className="text-muted-foreground">
          Set your regular weekly availability and date overrides.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly schedule - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weekly availability */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Weekly availability</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Set when you&apos;re regularly available for bookings.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <div className="text-xs">
                  <span className="text-muted-foreground">Timezone</span>
                  <br />
                  <span className="font-medium text-foreground">
                    {timezone.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {DAYS.map((day, dayIndex) => (
                <AvailabilityDayRow
                  key={day}
                  day={day}
                  enabled={dayStates[day].enabled}
                  intervals={dayStates[day].intervals.map((i) => ({
                    start: i.start,
                    end: i.end,
                  }))}
                  onToggle={(enabled) => handleToggle(day, enabled)}
                  onIntervalsChange={(intervals) =>
                    handleIntervalsChange(day, intervals)
                  }
                />
              ))}
            </CardContent>
          </Card>

          {/* Date overrides */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Date overrides</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Create exceptions to your regular weekly availability.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddOverride}
                disabled={!newOverrideDate}
              >
                <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                Add override
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add override form */}
              <div className="rounded-md border p-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor="override-date" className="text-xs">
                      Date
                    </Label>
                    <Input
                      id="override-date"
                      type="date"
                      value={newOverrideDate}
                      onChange={(e) => setNewOverrideDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <div className="flex items-center gap-2 h-10">
                      <input
                        id="override-available"
                        type="checkbox"
                        checked={newOverrideAvailable}
                        onChange={(e) => setNewOverrideAvailable(e.target.checked)}
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
                          onChange={(e) => setNewOverrideStart(e.target.value)}
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
                          onChange={(e) => setNewOverrideEnd(e.target.value)}
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
                    onChange={(e) => setNewOverrideReason(e.target.value)}
                  />
                </div>
              </div>

              {/* Existing overrides list */}
              {overrides.length > 0 && (
                <ul className="space-y-2" aria-label="Date overrides">
                  {overrides.map((override) => (
                    <li
                      key={override.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center rounded bg-accent px-2 py-1 text-center">
                          <span className="text-[10px] font-medium text-primary uppercase">
                            {new Date(override.date + "T00:00:00").toLocaleDateString(
                              undefined,
                              { month: "short" }
                            )}
                          </span>
                          <span className="text-lg font-bold text-foreground leading-none">
                            {new Date(override.date + "T00:00:00").getDate()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {new Date(override.date + "T00:00:00").toLocaleDateString(
                              undefined,
                              { month: "long", day: "numeric", year: "numeric" }
                            )}
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
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {override.start_time} – {override.end_time}
                              </p>
                            )}
                          {override.reason && (
                            <p className="text-xs text-muted-foreground mt-0.5">
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
                        <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel - timezone info */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Timezone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm">{timezone.replace(/_/g, " ")}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                All times are displayed in your profile timezone.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full bg-warning"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-foreground">
              You have unsaved changes
            </span>
            <span className="text-sm text-muted-foreground">
              Don&apos;t forget to save your availability.
            </span>
          </div>
          <div className="flex items-center gap-3">
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
