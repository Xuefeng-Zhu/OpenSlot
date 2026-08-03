export type DashboardAvailabilityState =
  | 'configured'
  | 'needs_hours'
  | 'no_active_event_types'

export interface DashboardAvailabilityStateInput {
  activeEventTypes: Array<{ schedule_id: string }>
  schedules: Array<{ id: string; timezone: string }>
  rules: Array<{ schedule_id: string; is_active: boolean }>
  overrides: Array<{
    schedule_id: string
    date: string
    start_time: string | null
    end_time: string | null
    is_available: boolean
  }>
  now?: Date
}

export const dashboardAvailabilityCopy: Record<
  DashboardAvailabilityState,
  { value: string; description: string; actionHref: string }
> = {
  configured: {
    value: 'Configured',
    description: 'Booking hours are set for at least one active event type.',
    actionHref: '/availability',
  },
  needs_hours: {
    value: 'Needs hours',
    description: 'Add hours to a schedule used by an active event type.',
    actionHref: '/availability',
  },
  no_active_event_types: {
    value: 'No active types',
    description: 'Create or activate an event type before sharing availability.',
    actionHref: '/event-types',
  },
}

/**
 * Describes whether active event types have booking hours configured. This does
 * not claim that calendar conflicts, holds, or bookings leave a real-time slot.
 */
export function deriveDashboardAvailabilityState({
  activeEventTypes,
  schedules,
  rules,
  overrides,
  now = new Date(),
}: DashboardAvailabilityStateInput): DashboardAvailabilityState {
  if (activeEventTypes.length === 0) return 'no_active_event_types'

  const activeScheduleIds = new Set(
    activeEventTypes.map((eventType) => eventType.schedule_id)
  )

  if (
    rules.some(
      (rule) => rule.is_active && activeScheduleIds.has(rule.schedule_id)
    )
  ) {
    return 'configured'
  }

  const timezoneByScheduleId = new Map(
    schedules.map((schedule) => [schedule.id, schedule.timezone])
  )

  const hasCurrentOrFuturePositiveOverride = overrides.some((override) => {
    if (
      !override.is_available ||
      !activeScheduleIds.has(override.schedule_id) ||
      !isPositiveClockRange(override.start_time, override.end_time) ||
      !isDateOnly(override.date)
    ) {
      return false
    }

    const timezone = timezoneByScheduleId.get(override.schedule_id)
    const today = timezone ? dateKeyInTimezone(now, timezone) : null
    return today !== null && override.date >= today
  })

  return hasCurrentOrFuturePositiveOverride ? 'configured' : 'needs_hours'
}

function dateKeyInTimezone(date: Date, timezone: string): string | null {
  if (Number.isNaN(date.getTime())) return null

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timezone,
    }).formatToParts(date)
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((candidate) => candidate.type === type)?.value
    const year = part('year')
    const month = part('month')
    const day = part('day')
    return year && month && day ? `${year}-${month}-${day}` : null
  } catch {
    return null
  }
}

function isDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const [, year, month, day] = match
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return (
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() + 1 === Number(month) &&
    parsed.getUTCDate() === Number(day)
  )
}

function isPositiveClockRange(
  start: string | null,
  end: string | null
): boolean {
  const startSeconds = clockSeconds(start)
  const endSeconds = clockSeconds(end)
  return startSeconds !== null && endSeconds !== null && startSeconds < endSeconds
}

function clockSeconds(value: string | null): number | null {
  if (!value) return null
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? 0)
  if (hours > 23 || minutes > 59 || seconds > 59) return null
  return hours * 3_600 + minutes * 60 + seconds
}
