import { NextRequest, NextResponse } from 'next/server'
import { validateHoldSlotRequest } from '@/lib/availability/available-slots'
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
 * Uses a service-role RPC to create the hold and host reservation atomically.
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

    const slotValidation = await validateHoldSlotRequest({
      supabase: adminClient,
      hostUserId,
      eventTypeId,
      startAt,
      endAt,
    })

    if (!slotValidation.success) {
      return NextResponse.json(
        { error: slotValidation.error },
        { status: slotValidation.status }
      )
    }

    // Create the hold with 5-minute expiration. The RPC also inserts the
    // host_reservations row, whose exclusion constraint is the final race guard.
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { data: hold, error: insertError } = await adminClient
      .rpc('create_slot_hold_with_reservation', {
        p_event_type_id: eventTypeId,
        p_host_user_id: hostUserId,
        p_start_at: startAt,
        p_end_at: endAt,
        p_guest_email: guestEmail,
        p_expires_at: expiresAt,
      })
      .single()

    if (insertError) {
      if (insertError.code === '23P01' || insertError.code === '23505') {
        return NextResponse.json(
          { error: 'This time slot is currently held by another guest. Please select a different time.' },
          { status: 409 }
        )
      }

      if (insertError.code === 'P0002') {
        return NextResponse.json(
          { error: 'Event type not found' },
          { status: 404 }
        )
      }

      if (insertError.code === '22023') {
        return NextResponse.json(
          { error: 'This time slot is no longer available. Please select a different time.' },
          { status: 409 }
        )
      }

      console.error('Error creating hold:', insertError)
      return NextResponse.json(
        { error: 'Failed to create hold' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        holdId: hold.hold_id,
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
