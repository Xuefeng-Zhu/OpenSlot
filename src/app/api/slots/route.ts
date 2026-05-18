import { NextRequest, NextResponse } from 'next/server'
import { loadAvailableSlotsForDate } from '@/lib/availability/available-slots'
import {
  consumePublicRateLimit,
  publicRateLimitResponse,
} from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

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

    const adminClient = createAdminClient()
    const rateLimit = await consumePublicRateLimit({
      request,
      adminClient,
      config: {
        scope: 'list-slots',
        limit: 120,
        windowSeconds: 60,
      },
    })

    if (!rateLimit.allowed) {
      return publicRateLimitResponse(rateLimit)
    }

    const slotsResult = await loadAvailableSlotsForDate({
      supabase: adminClient,
      hostUserId,
      eventTypeId,
      date,
      guestTimezone: timezone,
    })

    if (!slotsResult.success) {
      return NextResponse.json(
        { error: slotsResult.error },
        { status: slotsResult.status }
      )
    }

    return NextResponse.json({ slots: slotsResult.slots })
  } catch (error) {
    console.error('Error computing available slots:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
