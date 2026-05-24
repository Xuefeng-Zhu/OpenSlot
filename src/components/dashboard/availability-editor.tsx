'use client'

import { useState } from 'react'
import { createBrowserBackendClient } from '@/lib/backend/compat/browser-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, X } from 'lucide-react'
import type { Tables } from '@/lib/types/database'

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

interface AvailabilityRule {
  id?: string
  weekday: number
  start_time: string
  end_time: string
  timezone: string
  is_active: boolean
}

interface AvailabilityOverride {
  id?: string
  date: string
  start_time: string | null
  end_time: string | null
  timezone: string
  is_available: boolean
  reason: string | null
}

interface AvailabilityEditorProps {
  profileId: string
  defaultTimezone: string
  initialRules: Tables<'availability_rules'>[]
  initialOverrides: Tables<'availability_overrides'>[]
}

export function AvailabilityEditor({
  profileId,
  defaultTimezone,
  initialRules,
  initialOverrides,
}: AvailabilityEditorProps) {
  const [rules, setRules] = useState<AvailabilityRule[]>(
    initialRules.map((r) => ({
      id: r.id,
      weekday: r.weekday,
      start_time: r.start_time,
      end_time: r.end_time,
      timezone: r.timezone,
      is_active: r.is_active,
    }))
  )
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>(
    initialOverrides.map((o) => ({
      id: o.id,
      date: o.date,
      start_time: o.start_time,
      end_time: o.end_time,
      timezone: o.timezone,
      is_available: o.is_available,
      reason: o.reason,
    }))
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Override form state
  const [newOverrideDate, setNewOverrideDate] = useState('')
  const [newOverrideAvailable, setNewOverrideAvailable] = useState(false)
  const [newOverrideStart, setNewOverrideStart] = useState('')
  const [newOverrideEnd, setNewOverrideEnd] = useState('')
  const [newOverrideReason, setNewOverrideReason] = useState('')

  function addTimeWindow(weekday: number) {
    setRules((prev) => [
      ...prev,
      {
        weekday,
        start_time: '09:00',
        end_time: '17:00',
        timezone: defaultTimezone,
        is_active: true,
      },
    ])
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRule(index: number, field: keyof AvailabilityRule, value: string | boolean) {
    setRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, [field]: value } : rule))
    )
  }

  function toggleRuleActive(index: number) {
    setRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, is_active: !rule.is_active } : rule))
    )
  }

  function addOverride() {
    if (!newOverrideDate) return

    // Validate times if marking as available
    if (newOverrideAvailable && (!newOverrideStart || !newOverrideEnd)) return
    if (newOverrideAvailable && newOverrideStart >= newOverrideEnd) return

    setOverrides((prev) => [
      ...prev,
      {
        date: newOverrideDate,
        start_time: newOverrideAvailable ? newOverrideStart : null,
        end_time: newOverrideAvailable ? newOverrideEnd : null,
        timezone: defaultTimezone,
        is_available: newOverrideAvailable,
        reason: newOverrideReason || null,
      },
    ])

    // Reset form
    setNewOverrideDate('')
    setNewOverrideAvailable(false)
    setNewOverrideStart('')
    setNewOverrideEnd('')
    setNewOverrideReason('')
  }

  function removeOverride(index: number) {
    setOverrides((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const backendClient = createBrowserBackendClient()

      // Validate all rules
      for (const rule of rules) {
        if (rule.start_time >= rule.end_time) {
          setSaveMessage({ type: 'error', text: 'Start time must be before end time for all rules.' })
          setIsSaving(false)
          return
        }
      }

      // Delete existing rules and overrides, then re-insert
      // This is simpler than diffing for an MVP
      const { error: deleteRulesError } = await (backendClient
        .from('availability_rules') as any)
        .delete()
        .eq('user_id', profileId)

      if (deleteRulesError) {
        setSaveMessage({ type: 'error', text: 'Failed to save availability rules.' })
        setIsSaving(false)
        return
      }

      const { error: deleteOverridesError } = await (backendClient
        .from('availability_overrides') as any)
        .delete()
        .eq('user_id', profileId)

      if (deleteOverridesError) {
        setSaveMessage({ type: 'error', text: 'Failed to save availability overrides.' })
        setIsSaving(false)
        return
      }

      // Insert rules
      if (rules.length > 0) {
        const rulesToInsert = rules.map((rule) => ({
          user_id: profileId,
          weekday: rule.weekday,
          start_time: rule.start_time,
          end_time: rule.end_time,
          timezone: rule.timezone,
          is_active: rule.is_active,
        }))

        const { error: insertRulesError } = await (backendClient
          .from('availability_rules') as any)
          .insert(rulesToInsert)

        if (insertRulesError) {
          setSaveMessage({ type: 'error', text: 'Failed to save availability rules.' })
          setIsSaving(false)
          return
        }
      }

      // Insert overrides
      if (overrides.length > 0) {
        const overridesToInsert = overrides.map((override) => ({
          user_id: profileId,
          date: override.date,
          start_time: override.start_time,
          end_time: override.end_time,
          timezone: override.timezone,
          is_available: override.is_available,
          reason: override.reason,
        }))

        const { error: insertOverridesError } = await (backendClient
          .from('availability_overrides') as any)
          .insert(overridesToInsert)

        if (insertOverridesError) {
          setSaveMessage({ type: 'error', text: 'Failed to save availability overrides.' })
          setIsSaving(false)
          return
        }
      }

      setSaveMessage({ type: 'success', text: 'Availability saved successfully.' })
    } catch {
      setSaveMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setIsSaving(false)
    }
  }

  function getRulesForWeekday(weekday: number) {
    return rules
      .map((rule, index) => ({ ...rule, _index: index }))
      .filter((rule) => rule.weekday === weekday)
  }

  return (
    <div className="space-y-8">
      {/* Weekly Availability Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Availability</CardTitle>
          <CardDescription>
            Set your recurring weekly availability. Add multiple time windows per day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {WEEKDAY_NAMES.map((dayName, weekday) => {
            const dayRules = getRulesForWeekday(weekday)
            return (
              <div key={weekday} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">{dayName}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addTimeWindow(weekday)}
                    aria-label={`Add time window for ${dayName}`}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </div>
                {dayRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No availability set</p>
                ) : (
                  <div className="space-y-2">
                    {dayRules.map((rule) => (
                      <div
                        key={rule._index}
                        className="flex items-center gap-2 rounded-md border p-2"
                      >
                        <Input
                          type="time"
                          value={rule.start_time}
                          onChange={(e) =>
                            updateRule(rule._index, 'start_time', e.target.value)
                          }
                          className="w-32"
                          aria-label={`Start time for ${dayName}`}
                        />
                        <span className="text-sm text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={rule.end_time}
                          onChange={(e) =>
                            updateRule(rule._index, 'end_time', e.target.value)
                          }
                          className="w-32"
                          aria-label={`End time for ${dayName}`}
                        />
                        <button
                          type="button"
                          onClick={() => toggleRuleActive(rule._index)}
                          className="ml-auto"
                          aria-label={
                            rule.is_active
                              ? `Deactivate time window for ${dayName}`
                              : `Activate time window for ${dayName}`
                          }
                        >
                          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRule(rule._index)}
                          aria-label={`Remove time window for ${dayName}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Date-Specific Overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Date-Specific Overrides</CardTitle>
          <CardDescription>
            Override your weekly availability for specific dates. Mark days as unavailable or set
            custom hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing overrides */}
          {overrides.length > 0 && (
            <div className="space-y-2">
              {overrides.map((override, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-md border p-3"
                >
                  <span className="font-medium">{override.date}</span>
                  {override.is_available ? (
                    <Badge variant="default">
                      {override.start_time} - {override.end_time}
                    </Badge>
                  ) : (
                    <Badge variant="danger">Unavailable</Badge>
                  )}
                  {override.reason && (
                    <span className="text-sm text-muted-foreground">
                      ({override.reason})
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    onClick={() => removeOverride(index)}
                    aria-label={`Remove override for ${override.date}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new override form */}
          <div className="rounded-md border p-4 space-y-3">
            <Label className="text-sm font-medium">Add Override</Label>
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
            <Button type="button" variant="outline" size="sm" onClick={addOverride}>
              <Plus className="mr-1 h-3 w-3" />
              Add Override
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save button and messages */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Availability'}
        </Button>
        {saveMessage && (
          <p
            className={`text-sm ${
              saveMessage.type === 'success' ? 'text-green-600' : 'text-destructive'
            }`}
            role="alert"
          >
            {saveMessage.text}
          </p>
        )}
      </div>
    </div>
  )
}
