import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createHoldSchema } from '@/lib/validations/booking'

/**
 * POST /api/holds
 *
 * Creates a temporary hold on a time slot for a guest.
 * The hold expires after 5 minutes.
 *
 * Request body: { eventTypeId, hostUserId, startAt, endAt, guestEmail }
 * Response: { holdId, holdToken, expiresAt } or error
 *
 * Uses the service role client to bypass RLS for slot_holds table.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input with Zod
    const parsed = createHoldSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { eventTypeId, hostUserId, startAt, endAt, guestEmail } = parsed.data

    // Validate that startAt is before endAt
    if (new Date(startAt) >= new Date(endAt)) {
      return NextResponse.json(
        { error: 'Start time must be before end time' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Check for existing active hold or confirmed booking that conflicts
    // with the requested time range for this host
    const nowISO = new Date().toISOString()

    // Check for conflicting active holds (not expired)
    const { data: conflictingHolds, error: holdsError } = await adminClient
      .from('slot_holds')
      .select('id')
      .eq('host_user_id', hostUserId)
      .eq('status', 'active')
      .gt('expires_at', nowISO)
      .lt('start_at', endAt)
      .gt('end_at', startAt)
      .limit(1)

    if (holdsError) {
      console.error('Error checking conflicting holds:', holdsError)
      return NextResponse.json(
        { error: 'Failed to check slot availability' },
        { status: 500 }
      )
    }

    if (conflictingHolds && conflictingHolds.length > 0) {
      return NextResponse.json(
        { error: 'This time slot is currently held by another guest. Please select a different time.' },
        { status: 409 }
      )
    }

    // Check for conflicting confirmed bookings
    const { data: conflictingBookings, error: bookingsError } = await adminClient
      .from('bookings')
      .select('id')
      .eq('host_user_id', hostUserId)
      .eq('status', 'confirmed')
      .lt('start_at', endAt)
      .gt('end_at', startAt)
      .limit(1)

    if (bookingsError) {
      console.error('Error checking conflicting bookings:', bookingsError)
      return NextResponse.json(
        { error: 'Failed to check slot availability' },
        { status: 500 }
      )
    }

    if (conflictingBookings && conflictingBookings.length > 0) {
      return NextResponse.json(
        { error: 'This time slot is already booked. Please select a different time.' },
        { status: 409 }
      )
    }

    // Create the hold with 5-minute expiration
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { data: hold, error: insertError } = await adminClient
      .from('slot_holds')
      .insert({
        event_type_id: eventTypeId,
        host_user_id: hostUserId,
        start_at: startAt,
        end_at: endAt,
        guest_email: guestEmail,
        expires_at: expiresAt,
        status: 'active',
      })
      .select('id, hold_token, expires_at')
      .single()

    if (insertError) {
      console.error('Error creating hold:', insertError)
      return NextResponse.json(
        { error: 'Failed to create hold' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        holdId: hold.id,
        holdToken: hold.hold_token,
        expiresAt: hold.expires_at,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in POST /api/holds:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
