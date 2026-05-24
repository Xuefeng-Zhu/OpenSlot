import { NextRequest, NextResponse } from 'next/server'
import {
  loadAvailableSlotsForDate,
  loadAvailableSlotsForDateRange,
} from '@/lib/availability/available-slots'
import type { TimeSlot } from '@/lib/availability/types'
import { addSlotHoldTokens } from '@/lib/availability/slot-token'
import {
  consumePublicRateLimit,
  publicRateLimitResponse,
} from '@/lib/security/rate-limit'
import { createAdminBackendClient } from '@/lib/backend/server'

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
 * - startDate/endDate: optional inclusive range alternative to date
 * - timezone: IANA timezone identifier (guest's timezone)
 *
 * Returns: { slots: TimeSlot[] } or { slotsByDate: Record<string, TimeSlot[]> }
 */
export const runtime = 'edge'

const MAX_SLOT_RANGE_DAYS = 60

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hostUserId = searchParams.get('hostUserId')
    const eventTypeId = searchParams.get('eventTypeId')
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const timezone = searchParams.get('timezone')
    const isRangeRequest = !date && Boolean(startDate || endDate)

    // Validate required params
    if (
      !hostUserId ||
      !eventTypeId ||
      !timezone ||
      (!date && (!startDate || !endDate))
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required query parameters: hostUserId, eventTypeId, timezone, and date or startDate/endDate',
        },
        { status: 400 }
      )
    }

    // Validate date format (YYYY-MM-DD)
    if (date && !isIsoDate(date)) {
      return NextResponse.json(
        { error: 'Invalid date. Expected a real YYYY-MM-DD calendar date.' },
        { status: 400 }
      )
    }

    if (isRangeRequest) {
      if (
        !startDate ||
        !endDate ||
        !isIsoDate(startDate) ||
        !isIsoDate(endDate)
      ) {
        return NextResponse.json(
          {
            error:
              'Invalid date range. Expected real YYYY-MM-DD calendar dates.',
          },
          { status: 400 }
        )
      }

      const rangeLength = dateRangeLength(startDate, endDate)
      if (rangeLength < 1) {
        return NextResponse.json(
          { error: 'Invalid date range.' },
          { status: 400 }
        )
      }

      if (rangeLength > MAX_SLOT_RANGE_DAYS) {
        return NextResponse.json(
          { error: `Date range cannot exceed ${MAX_SLOT_RANGE_DAYS} days.` },
          { status: 400 }
        )
      }
    }

    const adminClient = createAdminBackendClient()
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

    if (isRangeRequest) {
      const slotsResult = await loadAvailableSlotsForDateRange({
        backendClient: adminClient,
        hostUserId,
        eventTypeId,
        startDate: startDate!,
        endDate: endDate!,
        guestTimezone: timezone,
      })

      if (!slotsResult.success) {
        return NextResponse.json(
          { error: slotsResult.error },
          { status: slotsResult.status }
        )
      }

      const slotsByDate = await addSlotHoldTokensByDate({
        slotsByDate: slotsResult.slotsByDate,
        hostUserId,
        eventTypeId,
      })

      return NextResponse.json({ slotsByDate })
    }

    const slotsResult = await loadAvailableSlotsForDate({
      backendClient: adminClient,
      hostUserId,
      eventTypeId,
      date: date!,
      guestTimezone: timezone,
    })

    if (!slotsResult.success) {
      return NextResponse.json(
        { error: slotsResult.error },
        { status: slotsResult.status }
      )
    }

    const slots = await addSlotHoldTokens({
      slots: slotsResult.slots,
      hostUserId,
      eventTypeId,
    })

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Error computing available slots:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function addSlotHoldTokensByDate({
  slotsByDate,
  hostUserId,
  eventTypeId,
}: {
  slotsByDate: Record<string, TimeSlot[]>
  hostUserId: string
  eventTypeId: string
}): Promise<Record<string, TimeSlot[]>> {
  const entries = await Promise.all(
    Object.entries(slotsByDate).map(async ([slotDate, slots]) => [
      slotDate,
      await addSlotHoldTokens({ slots, hostUserId, eventTypeId }),
    ])
  )

  return Object.fromEntries(entries)
}

function isIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function dateRangeLength(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0
  }

  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
}
