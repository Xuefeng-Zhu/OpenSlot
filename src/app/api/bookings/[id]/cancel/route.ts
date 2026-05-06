import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cancelBookingSchema } from '@/lib/validations/booking'
import { cancelBooking } from '@/lib/booking/cancel'

/**
 * POST /api/bookings/[id]/cancel
 *
 * Cancels a confirmed booking using its cancellation token.
 *
 * Request body: { cancellationToken: string, cancelReason?: string }
 * Response: { success: true } or { success: false, error: string }
 *
 * Uses the service role client to bypass RLS for bookings table.
 * The cancellation token serves as the authorization mechanism (guest operation).
 *
 * Note: The [id] in the route path is for RESTful convention. The actual
 * lookup uses the cancellationToken from the request body.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input with Zod
    const parsed = cancelBookingSchema.safeParse(body)
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

    // Delegate to the cancellation engine
    const result = await cancelBooking(parsed.data, adminClient)

    if (!result.success) {
      const status = getErrorStatus(result.error)
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error in POST /api/bookings/[id]/cancel:', error)
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

  if (error.includes('not found')) {
    return 404
  }
  if (error.includes('already been cancelled')) {
    return 409 // Conflict
  }
  if (error.includes('Failed to cancel')) {
    return 500
  }

  return 500
}
