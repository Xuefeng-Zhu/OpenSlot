import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rescheduleBookingSchema } from '@/lib/validations/booking'
import { rescheduleBooking } from '@/lib/booking/reschedule'
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
  hashRequestPayload,
  resolveIdempotencyKey,
  type IdempotencyEntry,
} from '@/lib/idempotency/request-idempotency'
import type { Json } from '@/lib/types/database'

/**
 * Reschedules a booking from a new hold and the original reschedule token.
 * Supports idempotency so browser retries do not create duplicate replacement
 * bookings or replay side effects with a different request body.
 */
export async function POST(request: NextRequest) {
  let adminClient: ReturnType<typeof createAdminClient> | null = null
  let idempotencyEntry: IdempotencyEntry | null = null

  try {
    const body = await request.json()
    const parsed = rescheduleBookingSchema.safeParse(body)

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

    adminClient = createAdminClient()
    const { idempotencyKey, ...rescheduleInput } = parsed.data

    const keyResult = resolveIdempotencyKey(
      idempotencyKey,
      request.headers.get('Idempotency-Key')
    )

    if (!keyResult.ok) {
      return NextResponse.json(
        { success: false, error: keyResult.error },
        { status: 400 }
      )
    }

    if (keyResult.key) {
      const idempotency = await beginIdempotentRequest({
        adminClient,
        scope: 'reschedule-booking',
        key: keyResult.key,
        requestHash: hashRequestPayload(rescheduleInput),
      })

      if (
        idempotency.type === 'replay' ||
        idempotency.type === 'conflict' ||
        idempotency.type === 'error'
      ) {
        return NextResponse.json(idempotency.response.body, {
          status: idempotency.response.status,
        })
      }

      idempotencyEntry = idempotency.entry
    }

    const result = await rescheduleBooking(rescheduleInput, adminClient)

    if (!result.success) {
      const status = getErrorStatus(result.error)
      await cacheIdempotentResponse(adminClient, idempotencyEntry, result, status)
      return NextResponse.json(result, { status })
    }

    await cacheIdempotentResponse(adminClient, idempotencyEntry, result, 201)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/bookings/reschedule:', error)
    const response = { success: false, error: 'Internal server error' }
    await cacheIdempotentResponse(adminClient, idempotencyEntry, response, 500)
    return NextResponse.json(response, { status: 500 })
  }
}

async function cacheIdempotentResponse(
  adminClient: ReturnType<typeof createAdminClient> | null,
  entry: IdempotencyEntry | null,
  body: unknown,
  status: number
) {
  if (!adminClient || !entry) return

  await completeIdempotentRequest({
    adminClient,
    entry,
    response: { body: body as Json, status },
  })
}

function getErrorStatus(error?: string): number {
  if (!error) return 500

  if (error.includes('not found') || error.includes('already used')) {
    return 404
  }
  if (error.includes('expired')) {
    return 410
  }
  if (error.includes('validation')) {
    return 400
  }
  if (
    error.includes('booked by someone else') ||
    error.includes('does not match')
  ) {
    return 409
  }

  return 500
}
