import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { confirmBookingSchema } from '@/lib/validations/booking'
import { confirmBooking } from '@/lib/booking/confirm'

/**
 * POST /api/bookings
 *
 * Confirms a booking from an active hold.
 *
 * Request body: { holdToken, guestName, guestEmail, guestTimezone, notes? }
 * Response: { success, bookingId, cancellationToken, rescheduleToken } or error
 *
 * Uses the service role client to bypass RLS for bookings and slot_holds tables.
 * The hold token serves as the authorization mechanism (guest operation).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input with Zod
    const parsed = confirmBookingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Delegate to the booking confirmation engine
    const result = await confirmBooking(parsed.data, adminClient)

    if (!result.success) {
      // Determine appropriate HTTP status based on error type
      const status = getErrorStatus(result.error)
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/bookings:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Maps error messages to appropriate HTTP status codes.
 */
function getErrorStatus(error?: string): number {
  if (!error) return 500

  if (error.includes('not found') || error.includes('already used')) {
    return 404
  }
  if (error.includes('expired')) {
    return 410 // Gone
  }
  if (error.includes('booked by someone else') || error.includes('slot taken')) {
    return 409 // Conflict
  }

  return 500
}
