import { NextRequest, NextResponse } from 'next/server'
import { createAdminBackendClient } from '@/lib/backend/server'
import { cancelBookingSchema } from '@/lib/validations/booking'
import { cancelBooking } from '@/lib/booking/cancel'
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
import { parseJsonBody } from '@/lib/http/json'
import { getBookingCancellationErrorStatus } from '../../error-status'

/**
 * POST /api/bookings/[id]/cancel
 *
 * Cancels a confirmed booking using its cancellation token.
 *
 * Request body: { cancellationToken: string, cancelReason?: string, idempotencyKey?: string }
 * Response: { success: true } or { success: false, error: string }
 *
 * Uses the service key client to bypass RLS for bookings table.
 * The cancellation token serves as the authorization mechanism (guest operation).
 *
 * Note: The [id] in the route path is for RESTful convention. The actual
 * lookup uses the cancellationToken from the request body.
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  let adminClient: ReturnType<typeof createAdminBackendClient> | null = null
  let idempotencyEntry: IdempotencyEntry | null = null

  try {
    const json = await parseJsonBody(request)
    if (!json.ok) return json.response

    // Validate input with Zod
    const parsed = cancelBookingSchema.safeParse(json.body)
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
    const { idempotencyKey, turnstileToken, ...cancelInput } = parsed.data

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
        scope: 'cancel-booking',
        key: keyResult.key,
        requestHash: hashRequestPayload(cancelInput),
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
        scope: 'cancel-booking',
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

    // Delegate to the cancellation engine
    const result = await cancelBooking(cancelInput, adminClient)

    if (!result.success) {
      const status = getBookingCancellationErrorStatus(result.error)
      await cacheIdempotentResponse(adminClient, idempotencyEntry, result, status)
      return NextResponse.json(result, { status })
    }

    await cacheIdempotentResponse(adminClient, idempotencyEntry, result, 200)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error in POST /api/bookings/[id]/cancel:', error)
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
