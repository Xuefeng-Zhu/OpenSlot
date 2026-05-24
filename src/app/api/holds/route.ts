import { NextRequest, NextResponse } from 'next/server'
import { validateHoldSlotRequest } from '@/lib/availability/available-slots'
import { verifySlotHoldToken } from '@/lib/availability/slot-token'
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
import { createAdminBackendClient } from '@/lib/backend/server'
import type { Json } from '@/lib/types/database'
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
 * Uses a service-key RPC to create the hold and host reservation atomically.
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  let adminClient: ReturnType<typeof createAdminBackendClient> | null = null
  let idempotencyEntry: IdempotencyEntry | null = null

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

    adminClient = createAdminBackendClient()
    const { idempotencyKey, turnstileToken, slotToken, ...holdInput } =
      parsed.data
    const { eventTypeId, hostUserId, startAt, endAt, guestEmail } = holdInput

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
        scope: 'create-hold',
        key: keyResult.key,
        requestHash: hashRequestPayload(holdInput),
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

    // Validate that startAt is before endAt
    if (new Date(startAt) >= new Date(endAt)) {
      await abandonIdempotentMarker(adminClient, idempotencyEntry)
      return NextResponse.json(
        { error: 'Start time must be before end time' },
        { status: 400 }
      )
    }

    const rateLimit = await consumePublicRateLimit({
      request,
      adminClient,
      config: {
        scope: 'create-hold',
        limit: 10,
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

    const slotTokenResult = slotToken
      ? await verifySlotHoldToken({
          token: slotToken,
          hostUserId,
          eventTypeId,
          startAt,
          endAt,
        })
      : null

    const slotValidation =
      slotTokenResult?.ok === true
        ? ({ success: true } as const)
        : await validateHoldSlotRequest({
            backendClient: adminClient,
            hostUserId,
            eventTypeId,
            startAt,
            endAt,
          })

    if (!slotValidation.success) {
      await cacheIdempotentResponse(
        adminClient,
        idempotencyEntry,
        { error: slotValidation.error },
        slotValidation.status
      )
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
        const response = {
          error:
            'This time slot is currently held by another guest. Please select a different time.',
        }
        await cacheIdempotentResponse(adminClient, idempotencyEntry, response, 409)
        return NextResponse.json(
          response,
          { status: 409 }
        )
      }

      if (insertError.code === 'P0002') {
        const response = { error: 'Event type not found' }
        await cacheIdempotentResponse(adminClient, idempotencyEntry, response, 404)
        return NextResponse.json(response, { status: 404 })
      }

      if (insertError.code === '22023') {
        const response = {
          error:
            'This time slot is no longer available. Please select a different time.',
        }
        await cacheIdempotentResponse(adminClient, idempotencyEntry, response, 409)
        return NextResponse.json(
          response,
          { status: 409 }
        )
      }

      console.error('Error creating hold:', insertError)
      const response = { error: 'Failed to create hold' }
      await cacheIdempotentResponse(adminClient, idempotencyEntry, response, 500)
      return NextResponse.json(response, { status: 500 })
    }

    const response = {
      holdId: hold.hold_id,
      holdToken: hold.hold_token,
      expiresAt: hold.expires_at,
    }
    await cacheIdempotentResponse(adminClient, idempotencyEntry, response, 201)
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/holds:', error)
    const response = { error: 'Internal server error' }
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
