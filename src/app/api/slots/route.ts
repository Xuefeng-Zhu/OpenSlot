import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAvailableSlots } from '@/lib/availability/compute-slots'
import type { Tables } from '@/lib/types/database'
import type {
  AvailabilityRule,
  AvailabilityOverride,
  TimeSlot,
} from '@/lib/availability/types'

/**
 * GET /api/slots
 *
 * Public endpoint that computes available time slots for a given host,
 * event type, date, and guest timezone.
 *
 * Query params:
 * - hostUserId: UUID of the host's profile
 * - eventTypeId: UUID of the event type
 * - date: YYYY-MM-DD in guest timezone
 * - timezone: IANA timezone identifier (guest's timezone)
 *
 * Returns: { slots: TimeSlot[] }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hostUserId = searchParams.get('hostUserId')
    const eventTypeId = searchParams.get('eventTypeId')
    const date = searchParams.get('date')
    const timezone = searchParams.get('timezone')

    // Validate required params
    if (!hostUserId || !eventTypeId || !date || !timezone) {
      return NextResponse.json(
        {
          error:
            'Missing required query parameters: hostUserId, eventTypeId, date, timezone',
        },
        { status: 400 }
      )
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Fetch event type to get duration, buffers, min_notice, max_booking_days
    const { data: eventTypeData, error: eventTypeError } = await supabase
      .from('event_types')
      .select('duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_booking_days_ahead, user_id, is_active')
      .eq('id', eventTypeId)
      .eq('user_id', hostUserId)
      .eq('is_active', true)
      .single()

    const eventType = eventTypeData as Pick<
      Tables<'event_types'>,
      'duration_minutes' | 'buffer_before_minutes' | 'buffer_after_minutes' | 'min_notice_minutes' | 'max_booking_days_ahead' | 'user_id' | 'is_active'
    > | null

    if (eventTypeError || !eventType) {
      return NextResponse.json(
        { error: 'Event type not found' },
        { status: 404 }
      )
    }

    const conflictLookupRange = paddedConflictLookupRange(
      date,
      eventType.buffer_before_minutes,
      eventType.buffer_after_minutes
    )

    // Fetch active availability rules for the host
    const { data: rulesData, error: rulesError } = await supabase
      .from('availability_rules')
      .select('id, user_id, weekday, start_time, end_time, timezone, is_active')
      .eq('user_id', hostUserId)
      .eq('is_active', true)

    if (rulesError) {
      return NextResponse.json(
        { error: 'Failed to fetch availability rules' },
        { status: 500 }
      )
    }

    // Fetch availability overrides for the host on the requested date
    const { data: overridesData, error: overridesError } = await supabase
      .from('availability_overrides')
      .select('id, user_id, date, start_time, end_time, timezone, is_available, reason')
      .eq('user_id', hostUserId)
      .eq('date', date)

    if (overridesError) {
      return NextResponse.json(
        { error: 'Failed to fetch availability overrides' },
        { status: 500 }
      )
    }

    // Fetch confirmed bookings for the host that overlap with the requested date.
    // The lookup range is padded for timezone boundaries and event buffers.
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select('start_at, end_at')
      .eq('host_user_id', hostUserId)
      .eq('status', 'confirmed')
      .lte('start_at', conflictLookupRange.end)
      .gte('end_at', conflictLookupRange.start)

    if (bookingsError) {
      return NextResponse.json(
        { error: 'Failed to fetch bookings' },
        { status: 500 }
      )
    }

    // Fetch active holds for the host that overlap with the requested date
    // and haven't expired yet
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
      return NextResponse.json(
        { error: 'Failed to fetch slot holds' },
        { status: 500 }
      )
    }

    // Fetch synced provider busy windows for the same conflict lookup range.
    const { slots: externalBusySlots, error: externalBusyError } =
      await fetchExternalBusySlots({
        supabase,
        hostUserId,
        rangeStart: conflictLookupRange.start,
        rangeEnd: conflictLookupRange.end,
      })

    if (externalBusyError) {
      return NextResponse.json(
        { error: externalBusyError },
        { status: 500 }
      )
    }

    const rules = (rulesData ?? []) as Pick<Tables<'availability_rules'>, 'id' | 'user_id' | 'weekday' | 'start_time' | 'end_time' | 'timezone' | 'is_active'>[]
    const overrides = (overridesData ?? []) as Pick<Tables<'availability_overrides'>, 'id' | 'user_id' | 'date' | 'start_time' | 'end_time' | 'timezone' | 'is_available' | 'reason'>[]
    const bookings = (bookingsData ?? []) as Pick<Tables<'bookings'>, 'start_at' | 'end_at'>[]
    const holds = (holdsData ?? []) as Pick<Tables<'slot_holds'>, 'start_at' | 'end_at'>[]

    // Map database rows to TimeSlot format
    const existingBookings: TimeSlot[] = bookings.map((b) => ({
      start: b.start_at,
      end: b.end_at,
    }))

    const activeHolds: TimeSlot[] = holds.map((h) => ({
      start: h.start_at,
      end: h.end_at,
    }))

    // Map database rows to AvailabilityRule format
    const availabilityRules: AvailabilityRule[] = rules.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      weekday: r.weekday,
      start_time: r.start_time,
      end_time: r.end_time,
      timezone: r.timezone,
      is_active: r.is_active,
    }))

    // Map database rows to AvailabilityOverride format
    const availabilityOverrides: AvailabilityOverride[] = overrides.map(
      (o) => ({
        id: o.id,
        user_id: o.user_id,
        date: o.date,
        start_time: o.start_time,
        end_time: o.end_time,
        timezone: o.timezone,
        is_available: o.is_available,
        reason: o.reason ?? null,
      })
    )

    // Compute available slots
    const slots = computeAvailableSlots(
      {
        date,
        hostUserId,
        eventTypeId,
        guestTimezone: timezone,
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

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Error computing available slots:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Loads synced external calendar busy windows that can block public availability.
 * Missing connections or no calendars are treated as an empty busy list; provider
 * sync failures surface earlier when rebuilding the cache, not during slot reads.
 */
async function fetchExternalBusySlots({
  supabase,
  hostUserId,
  rangeStart,
  rangeEnd,
}: {
  supabase: ReturnType<typeof createAdminClient>
  hostUserId: string
  rangeStart: string
  rangeEnd: string
}): Promise<{ slots: TimeSlot[]; error: string | null }> {
  const { data: connectionsData, error: connectionsError } = await supabase
    .from('provider_connections')
    .select('id')
    .eq('profile_id', hostUserId)
    .eq('status', 'active')

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
