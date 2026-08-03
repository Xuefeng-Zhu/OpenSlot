"use client"

import { CalendarDays, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AvailabilityOverride } from "@/components/dashboard/availability-model"
import { useDashboardDisplayPreferences } from "@/components/dashboard/display-preferences-provider"
import {
  formatDashboardClockTime,
  formatDashboardDateOnly,
  formatDashboardDateOnlyDay,
  formatDashboardDateOnlyMonth,
} from "@/lib/dashboard/display-preferences"

interface AvailabilityOverridesCardProps {
  overrides: AvailabilityOverride[]
  newOverrideDate: string
  newOverrideAvailable: boolean
  newOverrideStart: string
  newOverrideEnd: string
  newOverrideReason: string
  newOverrideTimeError: string
  canAddOverride: boolean
  onAddOverride: () => void
  onRemoveOverride: (id: string) => void
  onNewOverrideDateChange: (value: string) => void
  onNewOverrideAvailableChange: (value: boolean) => void
  onNewOverrideStartChange: (value: string) => void
  onNewOverrideEndChange: (value: string) => void
  onNewOverrideReasonChange: (value: string) => void
}

export function AvailabilityOverridesCard({
  overrides,
  newOverrideDate,
  newOverrideAvailable,
  newOverrideStart,
  newOverrideEnd,
  newOverrideReason,
  newOverrideTimeError,
  canAddOverride,
  onAddOverride,
  onRemoveOverride,
  onNewOverrideDateChange,
  onNewOverrideAvailableChange,
  onNewOverrideStartChange,
  onNewOverrideEndChange,
  onNewOverrideReasonChange,
}: AvailabilityOverridesCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarDays
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
            <CardTitle className="text-base">Date-specific hours</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Adjust hours for specific days
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddOverride}
          disabled={!canAddOverride}
          aria-label="Add override"
          className="w-fit rounded-full px-4"
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          Hours
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <AvailabilityOverrideForm
          newOverrideDate={newOverrideDate}
          newOverrideAvailable={newOverrideAvailable}
          newOverrideStart={newOverrideStart}
          newOverrideEnd={newOverrideEnd}
          newOverrideReason={newOverrideReason}
          newOverrideTimeError={newOverrideTimeError}
          onNewOverrideDateChange={onNewOverrideDateChange}
          onNewOverrideAvailableChange={onNewOverrideAvailableChange}
          onNewOverrideStartChange={onNewOverrideStartChange}
          onNewOverrideEndChange={onNewOverrideEndChange}
          onNewOverrideReasonChange={onNewOverrideReasonChange}
        />

        {overrides.length > 0 ? (
          <AvailabilityOverrideList
            overrides={overrides}
            onRemoveOverride={onRemoveOverride}
          />
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
  )
}

type AvailabilityOverrideFormProps = Pick<
  AvailabilityOverridesCardProps,
  | "newOverrideDate"
  | "newOverrideAvailable"
  | "newOverrideStart"
  | "newOverrideEnd"
  | "newOverrideReason"
  | "newOverrideTimeError"
  | "onNewOverrideDateChange"
  | "onNewOverrideAvailableChange"
  | "onNewOverrideStartChange"
  | "onNewOverrideEndChange"
  | "onNewOverrideReasonChange"
>

function AvailabilityOverrideForm({
  newOverrideDate,
  newOverrideAvailable,
  newOverrideStart,
  newOverrideEnd,
  newOverrideReason,
  newOverrideTimeError,
  onNewOverrideDateChange,
  onNewOverrideAvailableChange,
  onNewOverrideStartChange,
  onNewOverrideEndChange,
  onNewOverrideReasonChange,
}: AvailabilityOverrideFormProps) {
  return (
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
            onChange={(event) => onNewOverrideDateChange(event.target.value)}
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
                onNewOverrideAvailableChange(event.target.checked)
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
                aria-describedby={
                  newOverrideTimeError ? "override-time-error" : undefined
                }
                onChange={(event) =>
                  onNewOverrideStartChange(event.target.value)
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
                aria-describedby={
                  newOverrideTimeError ? "override-time-error" : undefined
                }
                onChange={(event) => onNewOverrideEndChange(event.target.value)}
              />
            </div>
          </>
        )}
      </div>
      {newOverrideTimeError ? (
        <p id="override-time-error" className="text-xs text-destructive" role="alert">
          {newOverrideTimeError}
        </p>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="override-reason" className="text-xs">
          Reason (optional)
        </Label>
        <Input
          id="override-reason"
          placeholder="e.g. Holiday, Doctor appointment"
          value={newOverrideReason}
          onChange={(event) => onNewOverrideReasonChange(event.target.value)}
        />
      </div>
    </div>
  )
}

function AvailabilityOverrideList({
  overrides,
  onRemoveOverride,
}: {
  overrides: AvailabilityOverride[]
  onRemoveOverride: (id: string) => void
}) {
  const displayPreferences = useDashboardDisplayPreferences()

  return (
    <ul className="space-y-2" aria-label="Date-specific hours">
      {overrides.map((override) => (
        <li
          key={override.id}
          className="flex items-center justify-between rounded-lg border border-border p-3"
        >
          <AvailabilityOverrideSummary override={override} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onRemoveOverride(override.id)}
            aria-label={`Remove override for ${formatDashboardDateOnly(
              override.date,
              displayPreferences
            )}`}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  )
}

function AvailabilityOverrideSummary({
  override,
}: {
  override: AvailabilityOverride
}) {
  const displayPreferences = useDashboardDisplayPreferences()

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-center rounded bg-accent px-2 py-1 text-center">
        <span className="text-[10px] font-medium uppercase text-primary">
          {formatDashboardDateOnlyMonth(override.date)}
        </span>
        <span className="text-lg font-bold leading-none text-foreground">
          {formatDashboardDateOnlyDay(override.date)}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          {formatDashboardDateOnly(override.date, displayPreferences)}
        </p>
        <Badge
          variant={override.is_available ? "outline" : "secondary"}
          className="mt-0.5"
        >
          {override.is_available ? "Custom hours" : "Unavailable"}
        </Badge>
        {override.is_available && override.start_time && override.end_time && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDashboardClockTime(
              override.start_time,
              displayPreferences
            )}{" "}
            –{" "}
            {formatDashboardClockTime(override.end_time, displayPreferences)}
          </p>
        )}
        {override.reason && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {override.reason}
          </p>
        )}
      </div>
    </div>
  )
}
