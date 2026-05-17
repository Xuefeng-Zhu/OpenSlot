import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from 'date-fns'
import { computeAvailableSlots } from './compute-slots'
import type {
  AvailabilityOverride,
  AvailabilityRule,
  TimeSlot,
} from './types'
import { refreshCalendarAvailabilityForHost } from '@/lib/calendar/provider-sync'
import type { Database, Tables } from '@/lib/types/database'

type AdminClient = SupabaseClient<Database>

type AvailableSlotsFailure = {
  success: false
  error: string
  status: 400 | 404 | 409 | 500
}

type AvailableSlotsSuccess = {
  success: true
  slots: TimeSlot[]
}

type EventTypeAvailabilityConfig = Pick<
  Tables<'event_types'>,
  | 'duration_minutes'
  | 'buffer_before_minutes'
  | 'buffer_after_minutes'
  | 'min_notice_minutes'
  | 'max_booking_days_ahead'
  | 'user_id'
  | 'is_active'
>

export type AvailableSlotsResult =
  | AvailableSlotsSuccess
  | AvailableSlotsFailure

export type HoldSlotValidationResult =
  | { success: true }
  | AvailableSlotsFailure

/**
 * Computes the public availability for an active event type on one calendar
 * date. This keeps hold creation and slot reads on the same server-side rules.
 */
export async function loadAvailableSlotsForDate({
  supabase,
  hostUserId,
  eventTypeId,
  date,
  guestTimezone,
}: {
  supabase: AdminClient
  hostUserId: string
  eventTypeId: string
  date: string
  guestTimezone: string
}): Promise<AvailableSlotsResult> {
  const eventTypeResult = await loadEventTypeAvailabilityConfig({
    supabase,
    hostUserId,
    eventTypeId,
  })

  if (!eventTypeResult.success) {
    return eventTypeResult
  }

  return computeSlotsForDate({
    supabase,
    hostUserId,
    eventTypeId,
    date,
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
  supabase,
  hostUserId,
  eventTypeId,
  startAt,
  endAt,
}: {
  supabase: AdminClient
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
    supabase,
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

  await refreshCalendarAvailabilityForHost(
    supabase,
    hostUserId,
    refreshRange.start,
    refreshRange.end
  )

  for (const date of candidateDates) {
    const slotsResult = await computeSlotsForDate({
      supabase,
      hostUserId,
      eventTypeId,
      date,
      guestTimezone: 'UTC',
      eventType: eventTypeResult.eventType,
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
  supabase,
  hostUserId,
  eventTypeId,
}: {
  supabase: AdminClient
  hostUserId: string
  eventTypeId: string
}): Promise<
  | {
      success: true
      eventType: EventTypeAvailabilityConfig
    }
  | AvailableSlotsFailure
> {
  const { data: eventTypeData, error: eventTypeError } = await supabase
    .from('event_types')
    .select(
      'duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_booking_days_ahead, user_id, is_active'
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
  supabase,
  hostUserId,
  eventTypeId,
  date,
  guestTimezone,
  eventType,
  refreshExternalCalendars = false,
}: {
  supabase: AdminClient
  hostUserId: string
  eventTypeId: string
  date: string
  guestTimezone: string
  eventType: EventTypeAvailabilityConfig
  refreshExternalCalendars?: boolean
}): Promise<AvailableSlotsResult> {
  const conflictLookupRange = paddedConflictLookupRange(
    date,
    eventType.buffer_before_minutes,
    eventType.buffer_after_minutes
  )

  if (refreshExternalCalendars) {
    await refreshCalendarAvailabilityForHost(
      supabase,
      hostUserId,
      conflictLookupRange.start,
      conflictLookupRange.end
    )
  }

  const { data: rulesData, error: rulesError } = await supabase
    .from('availability_rules')
    .select('id, user_id, weekday, start_time, end_time, timezone, is_active')
    .eq('user_id', hostUserId)
    .eq('is_active', true)

  if (rulesError) {
    return {
      success: false,
      status: 500,
      error: 'Failed to fetch availability rules',
    }
  }

  const { data: overridesData, error: overridesError } = await supabase
    .from('availability_overrides')
    .select(
      'id, user_id, date, start_time, end_time, timezone, is_available, reason'
    )
    .eq('user_id', hostUserId)
    .eq('date', date)

  if (overridesError) {
    return {
      success: false,
      status: 500,
      error: 'Failed to fetch availability overrides',
    }
  }

  const { data: bookingsData, error: bookingsError } = await supabase
    .from('bookings')
    .select('start_at, end_at')
    .eq('host_user_id', hostUserId)
    .eq('status', 'confirmed')
    .lte('start_at', conflictLookupRange.end)
    .gte('end_at', conflictLookupRange.start)

  if (bookingsError) {
    return {
      success: false,
      status: 500,
      error: 'Failed to fetch bookings',
    }
  }

  const nowISO = new Date().toISOString()

  const { data: holdsData, error: holdsError } = await supabase
    .from('slot_holds')
    .select('start_at, end_at')
    .eq('host_user_id', hostUserId)
    .eq('status', 'active')
    .gt('expires_at', nowISO)
    .lte('start_at', conflictLookupRange.end)
    .gte('end_at', conflictLookupRange.start)

  if (holdsError) {
    return {
      success: false,
      status: 500,
      error: 'Failed to fetch slot holds',
    }
  }

  const { slots: externalBusySlots, error: externalBusyError } =
    await fetchExternalBusySlots({
      supabase,
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

  const rules = (rulesData ?? []) as Pick<
    Tables<'availability_rules'>,
    | 'id'
    | 'user_id'
    | 'weekday'
    | 'start_time'
    | 'end_time'
    | 'timezone'
    | 'is_active'
  >[]
  const overrides = (overridesData ?? []) as Pick<
    Tables<'availability_overrides'>,
    | 'id'
    | 'user_id'
    | 'date'
    | 'start_time'
    | 'end_time'
    | 'timezone'
    | 'is_available'
    | 'reason'
  >[]
  const bookings = (bookingsData ?? []) as Pick<
    Tables<'bookings'>,
    'start_at' | 'end_at'
  >[]
  const holds = (holdsData ?? []) as Pick<
    Tables<'slot_holds'>,
    'start_at' | 'end_at'
  >[]

  const availabilityRules: AvailabilityRule[] = rules.map((rule) => ({
    id: rule.id,
    user_id: rule.user_id,
    weekday: rule.weekday,
    start_time: rule.start_time,
    end_time: rule.end_time,
    timezone: rule.timezone,
    is_active: rule.is_active,
  }))

  const availabilityOverrides: AvailabilityOverride[] = overrides.map(
    (override) => ({
      id: override.id,
      user_id: override.user_id,
      date: override.date,
      start_time: override.start_time,
      end_time: override.end_time,
      timezone: override.timezone,
      is_available: override.is_available,
      reason: override.reason ?? null,
    })
  )

  const existingBookings: TimeSlot[] = bookings.map((booking) => ({
    start: booking.start_at,
    end: booking.end_at,
  }))

  const activeHolds: TimeSlot[] = holds.map((hold) => ({
    start: hold.start_at,
    end: hold.end_at,
  }))

  return {
    success: true,
    slots: computeAvailableSlots(
      {
        date,
        hostUserId,
        eventTypeId,
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
    ),
  }
}

async function fetchExternalBusySlots({
  supabase,
  hostUserId,
  rangeStart,
  rangeEnd,
}: {
  supabase: AdminClient
  hostUserId: string
  rangeStart: string
  rangeEnd: string
}): Promise<{ slots: TimeSlot[]; error: string | null }> {
  const { data: connectionsData, error: connectionsError } = await supabase
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

  const { data: calendarsData, error: calendarsError } = await supabase
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

  const { data: busyData, error: busyError } = await supabase
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

function candidateAvailabilityDates(start: Date): string[] {
  const dates = [start, addDays(start, -1), addDays(start, 1)].map((date) =>
    date.toISOString().slice(0, 10)
  )

  return [...new Set(dates)]
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
