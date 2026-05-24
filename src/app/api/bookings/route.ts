import { NextRequest, NextResponse } from 'next/server'
import { createAdminBackendClient } from '@/lib/backend/server'
import { confirmBookingSchema } from '@/lib/validations/booking'
import { confirmBooking } from '@/lib/booking/confirm'
import {
  abandonIdempotentRequest,
  beginIdempotentRequest,
  completeIdempotentRequest,
  hashRequestPayload,
  resolveIdempotencyKey,
  type IdempotencyEntry,
} from '@/lib/idempotency/request-idempotency'
import {
  consumePublicRateLimit,
  publicRateLimitResponse,
} from '@/lib/security/rate-limit'
import { verifyTurnstileToken } from '@/lib/security/turnstile'
import type { Json } from '@/lib/types/database'

/**
 * POST /api/bookings
 *
 * Confirms a booking from an active hold.
 *
 * Request body: { holdToken, guestName, guestEmail, guestTimezone, notes?, answers?, idempotencyKey? }
 * Response: { success, bookingId, cancellationToken, rescheduleToken } or error
 *
 * Uses the service key client to bypass RLS for bookings and slot_holds tables.
 * The hold token serves as the authorization mechanism (guest operation).
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  let adminClient: ReturnType<typeof createAdminBackendClient> | null = null
  let idempotencyEntry: IdempotencyEntry | null = null

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

    adminClient = createAdminBackendClient()
    const { idempotencyKey, turnstileToken, ...bookingInput } = parsed.data

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
        scope: 'confirm-booking',
        key: keyResult.key,
        requestHash: hashRequestPayload(bookingInput),
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

    const rateLimit = await consumePublicRateLimit({
      request,
      adminClient,
      config: {
        scope: 'confirm-booking',
        limit: 20,
        windowSeconds: 5 * 60,
      },
    })

    if (!rateLimit.allowed) {
      await abandonIdempotentMarker(adminClient, idempotencyEntry)
      return publicRateLimitResponse(rateLimit)
    }

    const turnstile = await verifyTurnstileToken({
      request,
      token: turnstileToken,
    })

    if (!turnstile.ok) {
      await abandonIdempotentMarker(adminClient, idempotencyEntry)
      return NextResponse.json(
        { success: false, error: turnstile.error },
        { status: turnstile.status }
      )
    }

    // Delegate to the booking confirmation engine
    const result = await confirmBooking(bookingInput, adminClient)

    if (!result.success) {
      // Determine appropriate HTTP status based on error type
      const status = getErrorStatus(result.error)
      await cacheIdempotentResponse(adminClient, idempotencyEntry, result, status)
      return NextResponse.json(result, { status })
    }

    await cacheIdempotentResponse(adminClient, idempotencyEntry, result, 201)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/bookings:', error)
    const response = { success: false, error: 'Internal server error' }
    await cacheIdempotentResponse(adminClient, idempotencyEntry, response, 500)
    return NextResponse.json(
      response,
      { status: 500 }
    )
  }
}

async function cacheIdempotentResponse(
  adminClient: ReturnType<typeof createAdminBackendClient> | null,
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

async function abandonIdempotentMarker(
  adminClient: ReturnType<typeof createAdminBackendClient> | null,
  entry: IdempotencyEntry | null
) {
  if (!adminClient || !entry) return

  await abandonIdempotentRequest({ adminClient, entry })
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
  if (error.includes('validation')) {
    return 400
  }
  if (error.includes('booked by someone else') || error.includes('slot taken')) {
    return 409 // Conflict
  }
  if (error.includes('conflicts with a connected calendar event')) {
    return 409
  }
  if (error.includes('Could not verify connected calendar availability')) {
    return 503
  }

  return 500
}
