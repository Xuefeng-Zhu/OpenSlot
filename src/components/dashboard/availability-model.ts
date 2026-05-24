import { toTimeInputValue } from "@/lib/utils/time"

export interface AvailabilityRule {
  id: string
  weekday: number
  start_time: string
  end_time: string
  is_active: boolean
}

export interface AvailabilityOverride {
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

export interface DayState {
  enabled: boolean
  intervals: Array<{ id?: string; start: string; end: string }>
}

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

type AvailabilityRuleDraft = Omit<AvailabilityRule, "id"> & { id?: string }
type AvailabilityOverrideDraft = Omit<AvailabilityOverride, "id"> & {
  id?: string
}

interface AvailabilitySaveRequestInput {
  dayStates: Record<string, DayState>
  overrides: AvailabilityOverride[]
  savedRules: AvailabilityRule[]
  savedOverrides: AvailabilityOverride[]
  selectedScheduleId: string
  timezone: string
}

export interface AvailabilitySaveResponse {
  rules?: AvailabilityRule[]
  overrides?: AvailabilityOverride[]
}

export interface AvailabilitySavePayload {
  scheduleId: string
  rules: AvailabilityRuleDraft[]
  overrides: AvailabilityOverrideDraft[]
  deletedRuleIds: string[]
  deletedOverrideIds: string[]
  timezone: string
}

/**
 * Converts database availability rules into the Monday-first editor state.
 * Rule ids are preserved so later saves can distinguish updates/deletes from
 * newly added intervals.
 */
export function buildDayStates(
  rules: AvailabilityRule[]
): Record<string, DayState> {
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

  for (const day of DAYS) {
    if (states[day].intervals.length > 0) {
      states[day].enabled = true
    }
  }

  return states
}

export function hasAvailabilityChanges({
  dayStates,
  overrides,
  savedRules,
  savedOverrides,
}: Pick<
  AvailabilitySaveRequestInput,
  "dayStates" | "overrides" | "savedRules" | "savedOverrides"
>) {
  const currentRules = flattenDayStatesToRules(dayStates)
  if (currentRules.length !== savedRules.length) return true

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
    if (!dayState.enabled && saved.is_active) return true
  }

  for (const day of DAYS) {
    const state = dayStates[day]
    if (state.enabled) {
      for (const interval of state.intervals) {
        if (!interval.id || interval.id.startsWith("temp_")) return true
      }
    }
  }

  if (overrides.length !== savedOverrides.length) return true
  for (const current of overrides) {
    const saved = savedOverrides.find((override) => override.id === current.id)
    if (!saved) return true
    if (
      current.date !== saved.date ||
      current.start_time !== saved.start_time ||
      current.end_time !== saved.end_time ||
      current.is_available !== saved.is_available ||
      current.reason !== saved.reason
    ) {
      return true
    }
  }

  return false
}

export function buildAvailabilitySaveRequest({
  dayStates,
  overrides,
  savedRules,
  savedOverrides,
  selectedScheduleId,
  timezone,
}: AvailabilitySaveRequestInput): {
  currentRules: AvailabilityRuleDraft[]
  payload: AvailabilitySavePayload
} {
  const currentRules = flattenDayStatesToRules(dayStates)
  const currentRuleIds = new Set(
    currentRules.filter((rule) => !isTempId(rule.id)).map((rule) => rule.id)
  )
  const deletedRuleIds = savedRules
    .filter((rule) => !currentRuleIds.has(rule.id))
    .map((rule) => rule.id)
  const rules = currentRules.map((rule) => stripTempId(rule))

  const currentOverrideIds = new Set(
    overrides
      .filter((override) => !isTempId(override.id))
      .map((override) => override.id)
  )
  const deletedOverrideIds = savedOverrides
    .filter((override) => !currentOverrideIds.has(override.id))
    .map((override) => override.id)
  const payloadOverrides = overrides.map((override) => stripTempId(override))

  return {
    currentRules,
    payload: {
      scheduleId: selectedScheduleId,
      rules,
      overrides: payloadOverrides,
      deletedRuleIds,
      deletedOverrideIds,
      timezone,
    },
  }
}

export function normalizeSavedAvailability({
  savedData,
  currentRules,
  currentOverrides,
  createTempId,
}: {
  savedData: AvailabilitySaveResponse | null | undefined
  currentRules: AvailabilityRuleDraft[]
  currentOverrides: AvailabilityOverride[]
  createTempId: () => string
}) {
  const rules = (savedData?.rules ?? currentRules).map((rule) => ({
    id: rule.id || createTempId(),
    weekday: rule.weekday,
    start_time: toTimeInputValue(rule.start_time) ?? "",
    end_time: toTimeInputValue(rule.end_time) ?? "",
    is_active: rule.is_active,
  }))
  const overrides = (savedData?.overrides ?? currentOverrides).map(
    (override) => ({
      id: override.id || createTempId(),
      date: override.date,
      start_time: toTimeInputValue(override.start_time),
      end_time: toTimeInputValue(override.end_time),
      is_available: override.is_available,
      reason: override.reason,
    })
  )

  return { rules, overrides }
}

/**
 * Converts the editor's Monday-first day state back to database-shaped rules.
 * Disabled days still emit their intervals with is_active=false so existing rows
 * can be updated rather than silently dropped.
 */
export function flattenDayStatesToRules(
  dayStates: Record<string, DayState>
): AvailabilityRuleDraft[] {
  const rules: AvailabilityRuleDraft[] = []

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

function dbWeekdayToDayIndex(dbWeekday: number): number {
  return dbWeekday === 0 ? 6 : dbWeekday - 1
}

function dayIndexToDbWeekday(dayIndex: number): number {
  return dayIndex === 6 ? 0 : dayIndex + 1
}

function stripTempId<TRecord extends { id?: string }>(
  record: TRecord
): Omit<TRecord, "id"> & { id?: string } {
  if (isTempId(record.id)) {
    const { id: _id, ...rest } = record
    return rest
  }

  return record
}

function isTempId(id: string | undefined): boolean {
  return !id || id.startsWith("temp_")
}
