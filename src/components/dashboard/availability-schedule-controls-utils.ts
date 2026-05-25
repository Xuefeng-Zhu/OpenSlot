import type { AvailabilitySchedule } from "@/components/dashboard/availability-model"

export function getScheduleDisplayName(
  schedule: AvailabilitySchedule | undefined
) {
  if (!schedule) return "Schedule"
  if (schedule.is_default && schedule.name === "Default schedule") {
    return "Working hours"
  }

  return schedule.name
}

export function getScheduleLabel(schedule: AvailabilitySchedule | undefined) {
  if (!schedule) return "Schedule"
  const name = getScheduleDisplayName(schedule)
  return schedule.is_default ? `${name} (default)` : name
}

export function getEventTypeCountLabel(count: number) {
  return `${count} event type${count === 1 ? "" : "s"}`
}
