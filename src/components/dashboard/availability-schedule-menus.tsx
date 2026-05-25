"use client"

import Link from "next/link"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AvailabilitySchedule } from "@/components/dashboard/availability-model"
import {
  getEventTypeCountLabel,
  getScheduleLabel,
} from "@/components/dashboard/availability-schedule-controls-utils"

interface SchedulePickerMenuProps {
  schedules: AvailabilitySchedule[]
  selectedSchedule: AvailabilitySchedule | undefined
  selectedScheduleId: string
  onScheduleChange: (scheduleId: string) => void
  onCreateSchedule: () => void
}

export function SchedulePickerMenu({
  schedules,
  selectedSchedule,
  selectedScheduleId,
  onScheduleChange,
  onCreateSchedule,
}: SchedulePickerMenuProps) {
  return (
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
          <ChevronDown className="h-5 w-5 shrink-0" aria-hidden="true" />
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
                onSelect={() => onScheduleChange(schedule.id)}
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
          onSelect={onCreateSchedule}
          className="gap-2 px-4 py-3"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create schedule
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface AssignedEventTypesMenuProps {
  assignedEventTypes: AvailabilitySchedule["assignedEventTypes"]
  assignedEventTypeCount: number
}

export function AssignedEventTypesMenu({
  assignedEventTypes,
  assignedEventTypeCount,
}: AssignedEventTypesMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto justify-start gap-1.5 px-0 py-0 text-base hover:bg-transparent"
        >
          <span className="font-semibold text-foreground">Active on:</span>
          <span className="font-semibold text-primary">
            {getEventTypeCountLabel(assignedEventTypeCount)}
          </span>
          <ChevronDown className="h-4 w-4 text-primary" aria-hidden="true" />
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
  )
}

interface ScheduleActionsMenuProps {
  selectedSchedule: AvailabilitySchedule | undefined
  isSavingSchedule: boolean
  onSetDefaultSchedule: () => void
  onRenameSchedule: () => void
  onDuplicateSchedule: () => void
  onDeleteSchedule: () => void
}

export function ScheduleActionsMenu({
  selectedSchedule,
  isSavingSchedule,
  onSetDefaultSchedule,
  onRenameSchedule,
  onDuplicateSchedule,
  onDeleteSchedule,
}: ScheduleActionsMenuProps) {
  const hasSelectedSchedule = Boolean(selectedSchedule)

  return (
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
              onSelect={() => void onSetDefaultSchedule()}
              disabled={isSavingSchedule || !hasSelectedSchedule}
              className="gap-2"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Set as default
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          onSelect={onRenameSchedule}
          disabled={isSavingSchedule || !hasSelectedSchedule}
          className="gap-2"
        >
          <Edit3 className="h-4 w-4" aria-hidden="true" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={onDuplicateSchedule}
          disabled={isSavingSchedule || !hasSelectedSchedule}
          className="gap-2"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDeleteSchedule}
          disabled={isSavingSchedule || !hasSelectedSchedule}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
