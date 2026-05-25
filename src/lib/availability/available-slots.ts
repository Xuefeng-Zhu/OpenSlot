import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import { addDays } from 'date-fns'
import { computeAvailableSlots } from './compute-slots'
import type {
  AvailabilityOverride,
  AvailabilityRule,
  TimeSlot,
} from './types'
import {
  refreshCalendarAvailabilityForHost,
  type RefreshCalendarAvailabilityResult,
} from '@/lib/calendar/provider-sync'
import type { Database, Tables } from '@/lib/types/database'

type AdminClient = BackendCompatClient<Database>

type AvailableSlotsFailure = {
  success: false
  error: string
  status: 400 | 404 | 409 | 500
}

type AvailableSlotsSuccess = {
  success: true
  slots: TimeSlot[]
}

type AvailableSlotsRangeSuccess = {
  success: true
  slotsByDate: Record<string, TimeSlot[]>
}

type EventTypeAvailabilityConfig = Pick<
  Tables<'event_types'>,
  | 'duration_minutes'
  | 'buffer_before_minutes'
  | 'buffer_after_minutes'
  | 'min_notice_minutes'
  | 'max_booking_days_ahead'
  | 'schedule_id'
  | 'user_id'
  | 'is_active'
>

type ScheduleAvailabilityConfig = Pick<
  Tables<'schedules'>,
  'id' | 'timezone'
>

const SLOT_CALENDAR_REFRESH_TIMEOUT_MS = 3_000

export type AvailableSlotsResult =
  | AvailableSlotsSuccess
  | AvailableSlotsFailure

export type AvailableSlotsRangeResult =
  | AvailableSlotsRangeSuccess
  | AvailableSlotsFailure

export type HoldSlotValidationResult =
  | { success: true }
  | AvailableSlotsFailure

/**
 * Computes the public availability for an active event type on one calendar
 * date. This keeps hold creation and slot reads on the same server-side rules.
 */
export async function loadAvailableSlotsForDate({
  backendClient,
  hostUserId,
  eventTypeId,
  date,
  guestTimezone,
}: {
  backendClient: AdminClient
  hostUserId: string
  eventTypeId: string
  date: string
  guestTimezone: string
}): Promise<AvailableSlotsResult> {
  const eventTypeResult = await loadEventTypeAvailabilityConfig({
    backendClient,
    hostUserId,
    eventTypeId,
  })

  if (!eventTypeResult.success) {
    return eventTypeResult
  }

  return computeSlotsForDate({
    backendClient,
    hostUserId,
    eventTypeId,
    date,
    guestTimezone,
    eventType: eventTypeResult.eventType,
    refreshExternalCalendars: true,
  })
}

/**
 * Computes public availability for an inclusive date range while sharing the
 * provider reads that are identical for each date. Public booking pages use
 * this to populate a window of dates with one `/api/slots` request.
 */
export async function loadAvailableSlotsForDateRange({
  backendClient,
  hostUserId,
  eventTypeId,
  startDate,
  endDate,
  guestTimezone,
}: {
  backendClient: AdminClient
  hostUserId: string
  eventTypeId: string
  startDate: string
  endDate: string
  guestTimezone: string
}): Promise<AvailableSlotsRangeResult> {
  const dates = enumerateDateRange(startDate, endDate)

  if (dates.length === 0) {
    return {
      success: false,
      status: 400,
      error: 'Invalid date range.',
    }
  }

  const eventTypeResult = await loadEventTypeAvailabilityConfig({
    backendClient,
    hostUserId,
    eventTypeId,
  })

  if (!eventTypeResult.success) {
    return eventTypeResult
  }

  return computeSlotsForDateRange({
    backendClient,
    hostUserId,
    eventTypeId,
    dates,
    guestTimezone,
    eventType: eventTypeResult.eventType,
    refreshExternalCalendars: true,
  })
}

/**
 * Verifies that a hold request exactly matches a slot that the public slot
 * endpoint would expose for the active host/event pair.
 */
export async function validateHoldSlotRequest({
  backendClient,
  hostUserId,
  eventTypeId,
  startAt,
  endAt,
}: {
  backendClient: AdminClient
  hostUserId: string
  eventTypeId: string
  startAt: string
  endAt: string
}): Promise<HoldSlotValidationResult> {
  const start = new Date(startAt)
  const end = new Date(endAt)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return {
      success: false,
      status: 400,
      error: 'Invalid hold time range.',
    }
  }

  const eventTypeResult = await loadEventTypeAvailabilityConfig({
    backendClient,
    hostUserId,
    eventTypeId,
  })

  if (!eventTypeResult.success) {
    return eventTypeResult
  }

  const expectedDurationMs =
    eventTypeResult.eventType.duration_minutes * 60 * 1000

  if (end.getTime() - start.getTime() !== expectedDurationMs) {
    return {
      success: false,
      status: 400,
      error: 'Requested hold duration must match the event type duration.',
    }
  }

  const candidateDates = candidateAvailabilityDates(start)
  const refreshRange = mergedConflictLookupRange(
    candidateDates,
    eventTypeResult.eventType.buffer_before_minutes,
    eventTypeResult.eventType.buffer_after_minutes
  )

  const refreshResult = await refreshCalendarAvailabilityForHost(
    backendClient,
    hostUserId,
    refreshRange.start,
    refreshRange.end
  )

  for (const date of candidateDates) {
    const slotsResult = await computeSlotsForDate({
      backendClient,
      hostUserId,
      eventTypeId,
      date,
      guestTimezone: 'UTC',
      eventType: eventTypeResult.eventType,
      skipExternalBusyLookup: refreshResult.checked === 0,
    })

    if (!slotsResult.success) {
      return slotsResult
    }

    if (slotsResult.slots.some((slot) => isExactSlotMatch(slot, start, end))) {
      return { success: true }
    }
  }

  return {
    success: false,
    status: 409,
    error: 'This time slot is no longer available. Please select a different time.',
  }
}

async function loadEventTypeAvailabilityConfig({
  backendClient,
  hostUserId,
  eventTypeId,
}: {
  backendClient: AdminClient
  hostUserId: string
  eventTypeId: string
}): Promise<
  | {
      success: true
      eventType: EventTypeAvailabilityConfig
    }
  | AvailableSlotsFailure
> {
  const { data: eventTypeData, error: eventTypeError } = await backendClient
    .from('event_types')
    .select(
      'duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_booking_days_ahead, schedule_id, user_id, is_active'
    )
    .eq('id', eventTypeId)
    .eq('user_id', hostUserId)
    .eq('is_active', true)
    .single()

  const eventType = eventTypeData as EventTypeAvailabilityConfig | null

  if (eventTypeError && eventTypeError.code !== 'PGRST116') {
    return {
      success: false,
      status: 500,
      error: 'Failed to fetch event type',
    }
  }

  if (!eventType) {
    return {
      success: false,
      status: 404,
      error: 'Event type not found',
    }
  }

  return {
    success: true,
    eventType,
  }
}

async function computeSlotsForDate({
  backendClient,
  hostUserId,
  eventTypeId,
  date,
  guestTimezone,
  eventType,
  refreshExternalCalendars = false,
  skipExternalBusyLookup = false,
}: {
  backendClient: AdminClient
  hostUserId: string
  eventTypeId: string
  date: string
  guestTimezone: string
  eventType: EventTypeAvailabilityConfig
  refreshExternalCalendars?: boolean
  skipExternalBusyLookup?: boolean
}): Promise<AvailableSlotsResult> {
  const rangeResult = await computeSlotsForDateRange({
    backendClient,
    hostUserId,
    eventTypeId,
    dates: [date],
    guestTimezone,
    eventType,
    refreshExternalCalendars,
    skipExternalBusyLookup,
  })

  if (!rangeResult.success) {
    return rangeResult
  }

  return {
    success: true,
    slots: rangeResult.slotsByDate[date] ?? [],
  }
}

async function computeSlotsForDateRange({
  backendClient,
  hostUserId,
  eventTypeId,
  dates,
  guestTimezone,
  eventType,
  refreshExternalCalendars = false,
  skipExternalBusyLookup = false,
}: {
  backendClient: AdminClient
  hostUserId: string
  eventTypeId: string
  dates: string[]
  guestTimezone: string
  eventType: EventTypeAvailabilityConfig
  refreshExternalCalendars?: boolean
  skipExternalBusyLookup?: boolean
}): Promise<AvailableSlotsRangeResult> {
  const scheduleResult = await loadScheduleAvailabilityConfig({
    backendClient,
    hostUserId,
    scheduleId: eventType.schedule_id,
  })

  if (!scheduleResult.success) {
    return scheduleResult
  }

  const conflictLookupRange = paddedConflictLookupRangeForDates(
    dates,
    eventType.buffer_before_minutes,
    eventType.buffer_after_minutes
  )

  const refreshPromise = refreshExternalCalendars
    ? refreshCalendarAvailabilityForSlotLookup({
        backendClient,
        hostUserId,
        rangeStart: conflictLookupRange.start,
        rangeEnd: conflictLookupRange.end,
      })
    : Promise.resolve<RefreshCalendarAvailabilityResult | null>(null)

  const rulesPromise = backendClient
    .from('availability_rules')
    .select(
      'id, user_id, schedule_id, weekday, start_time, end_time, timezone, is_active'
    )
    .eq('user_id', hostUserId)
    .eq('schedule_id', scheduleResult.schedule.id)
    .eq('is_active', true)

  const overridesPromise = backendClient
    .from('availability_overrides')
    .select(
      'id, user_id, schedule_id, date, start_time, end_time, timezone, is_available, reason'
    )
    .eq('user_id', hostUserId)
    .eq('schedule_id', scheduleResult.schedule.id)
    .in('date', dates)

  const bookingsPromise = backendClient
    .from('bookings')
    .select('start_at, end_at')
    .eq('host_user_id', hostUserId)
    .eq('status', 'confirmed')
    .lte('start_at', conflictLookupRange.end)
    .gte('end_at', conflictLookupRange.start)

  const nowISO = new Date().toISOString()

  const holdsPromise = backendClient
    .from('slot_holds')
    .select('start_at, end_at')
    .eq('host_user_id', hostUserId)
    .eq('status', 'active')
    .gt('expires_at', nowISO)
    .lte('start_at', conflictLookupRange.end)
    .gte('end_at', conflictLookupRange.start)

  const [
    refreshResult,
    { data: rulesData, error: rulesError },
    { data: overridesData, error: overridesError },
    { data: bookingsData, error: bookingsError },
    { data: holdsData, error: holdsError },
  ] = await Promise.all([
    refreshPromise,
    rulesPromise,
    overridesPromise,
    bookingsPromise,
    holdsPromise,
  ])

  if (rulesError) {
    return {
      success: false,
      status: 500,
      error: 'Failed to fetch availability rules',
    }
  }

  if (overridesError) {
    return {
      success: false,
      status: 500,
      error: 'Failed to fetch availability overrides',
    }
  }

  if (bookingsError) {
    return {
      success: false,
      status: 500,
      error: 'Failed to fetch bookings',
    }
  }

  if (holdsError) {
    return {
      success: false,
      status: 500,
      error: 'Failed to fetch slot holds',
    }
  }

  const shouldSkipExternalBusyLookup =
    skipExternalBusyLookup || refreshResult?.checked === 0

  const { slots: externalBusySlots, error: externalBusyError } =
    shouldSkipExternalBusyLookup
      ? { slots: [], error: null }
      : await fetchExternalBusySlots({
          backendClient,
          hostUserId,
          rangeStart: conflictLookupRange.start,
          rangeEnd: conflictLookupRange.end,
        })

  if (externalBusyError) {
    return {
      success: false,
      status: 500,
      error: externalBusyError,
    }
  }

  const availabilityRules = mapAvailabilityRules(rulesData ?? [])
  const availabilityOverrides = mapAvailabilityOverrides(overridesData ?? [])
  const existingBookings = mapTimeSlots(bookingsData ?? [])
  const activeHolds = mapTimeSlots(holdsData ?? [])
  const slotsByDate: Record<string, TimeSlot[]> = {}

  for (const date of dates) {
    slotsByDate[date] = computeAvailableSlots(
      {
        date,
        hostUserId,
        eventTypeId,
        scheduleTimezone: scheduleResult.schedule.timezone,
        guestTimezone,
        durationMinutes: eventType.duration_minutes,
        bufferBeforeMinutes: eventType.buffer_before_minutes,
        bufferAfterMinutes: eventType.buffer_after_minutes,
        minNoticeMinutes: eventType.min_notice_minutes,
        maxBookingDaysAhead: eventType.max_booking_days_ahead,
      },
      availabilityRules,
      availabilityOverrides,
      existingBookings,
      activeHolds,
      externalBusySlots
    )
  }

  return {
    success: true,
    slotsByDate,
  }
}

async function refreshCalendarAvailabilityForSlotLookup({
  backendClient,
  hostUserId,
  rangeStart,
  rangeEnd,
}: {
  backendClient: AdminClient
  hostUserId: string
  rangeStart: string
  rangeEnd: string
}): Promise<RefreshCalendarAvailabilityResult> {
  const abortController = new AbortController()
  const fetchImpl: typeof fetch = (input, init) =>
    fetchWithTimeout(input, {
      ...init,
      signal: init?.signal ?? abortController.signal,
    })

  try {
    return await withTimeout(
      refreshCalendarAvailabilityForHost(
        backendClient,
        hostUserId,
        rangeStart,
        rangeEnd,
        fetchImpl,
        { abortSignal: abortController.signal }
      ),
      SLOT_CALENDAR_REFRESH_TIMEOUT_MS,
      { checked: 1, refreshed: 0, failed: 1 },
      () => abortController.abort()
    )
  } catch (error) {
    console.warn('Skipping calendar availability refresh for slot lookup:', error)
    return { checked: 1, refreshed: 0, failed: 1 }
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
  onTimeout?: () => void
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false

  try {
    return await Promise.race([
      promise.catch((error) => {
        if (timedOut) return fallback
        throw error
      }),
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => {
          timedOut = true
          onTimeout?.()
          resolve(fallback)
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    SLOT_CALENDAR_REFRESH_TIMEOUT_MS
  )

  try {
    return await fetch(input, {
      ...init,
      signal: init?.signal ?? controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function loadScheduleAvailabilityConfig({
  backendClient,
  hostUserId,
  scheduleId,
}: {
  backendClient: AdminClient
  hostUserId: string
  scheduleId: string
}): Promise<
  | {
      success: true
      schedule: ScheduleAvailabilityConfig
    }
  | AvailableSlotsFailure
> {
  const { data: scheduleData, error: scheduleError } = await backendClient
    .from('schedules')
    .select('id, timezone')
    .eq('id', scheduleId)
    .eq('user_id', hostUserId)
    .single()

  const schedule = scheduleData as ScheduleAvailabilityConfig | null

  if (scheduleError && scheduleError.code !== 'PGRST116') {
    return {
      success: false,
      status: 500,
      error: 'Failed to fetch schedule',
    }
  }

  if (!schedule) {
    return {
      success: false,
      status: 404,
      error: 'Schedule not found',
    }
  }

  return {
    success: true,
    schedule,
  }
}

async function fetchExternalBusySlots({
  backendClient,
  hostUserId,
  rangeStart,
  rangeEnd,
}: {
  backendClient: AdminClient
  hostUserId: string
  rangeStart: string
  rangeEnd: string
}): Promise<{ slots: TimeSlot[]; error: string | null }> {
  const { data: connectionsData, error: connectionsError } = await backendClient
    .from('provider_connections')
    .select('id')
    .eq('profile_id', hostUserId)
    .in('status', ['active', 'error'])

  if (connectionsError) {
    return { slots: [], error: 'Failed to fetch calendar connections' }
  }

  const connectionIds = (
    (connectionsData ?? []) as Pick<Tables<'provider_connections'>, 'id'>[]
  ).map((connection) => connection.id)

  if (connectionIds.length === 0) {
    return { slots: [], error: null }
  }

  const { data: calendarsData, error: calendarsError } = await backendClient
    .from('provider_calendars')
    .select('id')
    .in('connection_id', connectionIds)
    .eq('use_for_availability', true)

  if (calendarsError) {
    return { slots: [], error: 'Failed to fetch availability calendars' }
  }

  const calendarIds = (
    (calendarsData ?? []) as Pick<Tables<'provider_calendars'>, 'id'>[]
  ).map((calendar) => calendar.id)

  if (calendarIds.length === 0) {
    return { slots: [], error: null }
  }

  const { data: busyData, error: busyError } = await backendClient
    .from('external_busy_cache')
    .select('start_at, end_at')
    .in('provider_calendar_id', calendarIds)
    .lte('start_at', rangeEnd)
    .gte('end_at', rangeStart)

  if (busyError) {
    return { slots: [], error: 'Failed to fetch external calendar busy times' }
  }

  const busyRows = (busyData ?? []) as Pick<
    Tables<'external_busy_cache'>,
    'start_at' | 'end_at'
  >[]

  return {
    slots: busyRows.map((busy) => ({
      start: busy.start_at,
      end: busy.end_at,
    })),
    error: null,
  }
}

function mapAvailabilityRules(rulesData: unknown): AvailabilityRule[] {
  const rules = (rulesData ?? []) as Pick<
    Tables<'availability_rules'>,
    | 'id'
    | 'user_id'
    | 'schedule_id'
    | 'weekday'
    | 'start_time'
    | 'end_time'
    | 'timezone'
    | 'is_active'
  >[]

  return rules.map((rule) => ({
    id: rule.id,
    user_id: rule.user_id,
    schedule_id: rule.schedule_id,
    weekday: rule.weekday,
    start_time: rule.start_time,
    end_time: rule.end_time,
    timezone: rule.timezone,
    is_active: rule.is_active,
  }))
}

function mapAvailabilityOverrides(overridesData: unknown): AvailabilityOverride[] {
  const overrides = (overridesData ?? []) as Pick<
    Tables<'availability_overrides'>,
    | 'id'
    | 'user_id'
    | 'schedule_id'
    | 'date'
    | 'start_time'
    | 'end_time'
    | 'timezone'
    | 'is_available'
    | 'reason'
  >[]

  return overrides.map((override) => ({
    id: override.id,
    user_id: override.user_id,
    schedule_id: override.schedule_id,
    date: override.date,
    start_time: override.start_time,
    end_time: override.end_time,
    timezone: override.timezone,
    is_available: override.is_available,
    reason: override.reason ?? null,
  }))
}

function mapTimeSlots(rowsData: unknown): TimeSlot[] {
  const rows = (rowsData ?? []) as Array<{
    start_at: string
    end_at: string
  }>

  return rows.map((row) => ({
    start: row.start_at,
    end: row.end_at,
  }))
}

/**
 * Expands the database conflict lookup around the requested date.
 * The extra day on both sides covers host/guest timezone boundaries, while the
 * buffer padding catches adjacent events that overlap only after buffers apply.
 */
function paddedConflictLookupRange(
  date: string,
  bufferBeforeMinutes: number,
  bufferAfterMinutes: number
): { start: string; end: string } {
  const dayStart = new Date(`${date}T00:00:00.000Z`)
  const dayEnd = new Date(`${date}T23:59:59.999Z`)
  const timezonePaddingMs = 24 * 60 * 60 * 1000

  return {
    start: new Date(
      dayStart.getTime() -
        timezonePaddingMs -
        bufferBeforeMinutes * 60 * 1000
    ).toISOString(),
    end: new Date(
      dayEnd.getTime() +
        timezonePaddingMs +
        bufferAfterMinutes * 60 * 1000
    ).toISOString(),
  }
}

function paddedConflictLookupRangeForDates(
  dates: string[],
  bufferBeforeMinutes: number,
  bufferAfterMinutes: number
): { start: string; end: string } {
  return {
    start: paddedConflictLookupRange(
      dates[0],
      bufferBeforeMinutes,
      bufferAfterMinutes
    ).start,
    end: paddedConflictLookupRange(
      dates[dates.length - 1],
      bufferBeforeMinutes,
      bufferAfterMinutes
    ).end,
  }
}

function candidateAvailabilityDates(start: Date): string[] {
  const dates = [start, addDays(start, -1), addDays(start, 1)].map((date) =>
    date.toISOString().slice(0, 10)
  )

  return [...new Set(dates)]
}

function enumerateDateRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end.getTime() < start.getTime()
  ) {
    return []
  }

  const dates: string[] = []
  let cursor = start

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor = addDays(cursor, 1)
  }

  return dates
}

function mergedConflictLookupRange(
  dates: string[],
  bufferBeforeMinutes: number,
  bufferAfterMinutes: number
): { start: string; end: string } {
  const ranges = dates.map((date) =>
    paddedConflictLookupRange(date, bufferBeforeMinutes, bufferAfterMinutes)
  )
  const starts = ranges.map((range) => new Date(range.start).getTime())
  const ends = ranges.map((range) => new Date(range.end).getTime())

  return {
    start: new Date(Math.min(...starts)).toISOString(),
    end: new Date(Math.max(...ends)).toISOString(),
  }
}

function isExactSlotMatch(slot: TimeSlot, start: Date, end: Date): boolean {
  return (
    new Date(slot.start).getTime() === start.getTime() &&
    new Date(slot.end).getTime() === end.getTime()
  )
}
