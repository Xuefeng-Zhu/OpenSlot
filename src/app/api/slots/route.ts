import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
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

    const supabase = await createServerSupabaseClient()

    // Fetch event type to get duration, buffers, min_notice, max_booking_days
    const { data: eventTypeData, error: eventTypeError } = await supabase
      .from('event_types')
      .select('duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_booking_days_ahead')
      .eq('id', eventTypeId)
      .single()

    const eventType = eventTypeData as Pick<
      Tables<'event_types'>,
      'duration_minutes' | 'buffer_before_minutes' | 'buffer_after_minutes' | 'min_notice_minutes' | 'max_booking_days_ahead'
    > | null

    if (eventTypeError || !eventType) {
      return NextResponse.json(
        { error: 'Event type not found' },
        { status: 404 }
      )
    }

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
    // We query bookings whose time range intersects the day (date 00:00 to date+1 00:00 UTC).
    // Using a generous range to account for timezone differences and buffers.
    const dayStart = `${date}T00:00:00Z`
    const dayEnd = `${date}T23:59:59Z`

    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select('start_at, end_at')
      .eq('host_user_id', hostUserId)
      .eq('status', 'confirmed')
      .lte('start_at', dayEnd)
      .gte('end_at', dayStart)

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
      .lte('start_at', dayEnd)
      .gte('end_at', dayStart)

    if (holdsError) {
      return NextResponse.json(
        { error: 'Failed to fetch slot holds' },
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
      activeHolds
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
