"use client"

import { CalendarDays, Clock } from "lucide-react"
import {
  AvailabilityDayRow,
  type TimeInterval,
} from "@/components/dashboard/availability-day-row"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DAYS,
  type DayState,
} from "@/components/dashboard/availability-model"

interface AvailabilityWeeklyHoursCardProps {
  dayStates: Record<string, DayState>
  timezone: string
  onToggleDay: (day: string, enabled: boolean) => void
  onIntervalsChange: (day: string, intervals: TimeInterval[]) => void
}

export function AvailabilityWeeklyHoursCard({
  dayStates,
  timezone,
  onToggleDay,
  onIntervalsChange,
}: AvailabilityWeeklyHoursCardProps) {
  return (
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
            onToggle={(enabled) => onToggleDay(day, enabled)}
            onIntervalsChange={(intervals) => onIntervalsChange(day, intervals)}
          />
        ))}
      </CardContent>
    </Card>
  )
}
