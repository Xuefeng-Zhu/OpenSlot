import { NextRequest, NextResponse } from 'next/server'
import { loadAvailableSlotsForDate } from '@/lib/availability/available-slots'
import { addSlotHoldTokens } from '@/lib/availability/slot-token'
import {
  runBookingAgentFallbackTurn,
  runBookingAgentTurn,
  type RunBookingAgentInput,
} from '@/lib/booking-agent/agent'
import {
  BookingAgentGatewayError,
  ButterbaseBookingAgentProvider,
  isBookingAgentConfigured,
} from '@/lib/backend/booking-agent-gateway'
import {
  bookingAgentRequestSchema,
  type BookingAgentEventContext,
} from '@/lib/booking-agent/types'
import {
  consumePublicRateLimit,
  publicRateLimitResponse,
} from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Tables } from '@/lib/types/database'
import { normalizeInviteeQuestions } from '@/lib/validations/invitee-questions'

export const runtime = 'edge'

type AdminClient = ReturnType<typeof createAdminClient>

type BookingAgentEventType = Pick<
  Tables<'event_types'>,
  | 'id'
  | 'title'
  | 'description'
  | 'duration_minutes'
  | 'location_type'
  | 'location_value'
  | 'invitee_questions'
  | 'user_id'
  | 'is_active'
>

type BookingAgentProfile = Pick<Tables<'profiles'>, 'id' | 'name' | 'username'>

type BookingAgentContextResult =
  | { ok: true; context: BookingAgentEventContext }
  | { ok: false; status: 404 | 500; error: string }

/**
 * Runs one ephemeral public booking-assistant turn. The route may read public
 * event context and availability, but booking mutations stay in hold/booking
 * routes so tokens, Turnstile, and idempotency remain authoritative there.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = bookingAgentRequestSchema.safeParse(body)

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

    if (!isBookingAgentConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Booking assistant is not configured.',
        },
        { status: 503 }
      )
    }

    const adminClient = createAdminClient()
    const rateLimit = await consumePublicRateLimit({
      request,
      adminClient,
      config: {
        scope: 'booking-agent',
        limit: 20,
        windowSeconds: 5 * 60,
        identifierParts: [parsed.data.hostUserId, parsed.data.eventTypeId],
      },
    })

    if (!rateLimit.allowed) {
      return publicRateLimitResponse(rateLimit)
    }

    const eventContextResult = await loadBookingAgentEventContext(
      adminClient,
      parsed.data.hostUserId,
      parsed.data.eventTypeId
    )

    if (!eventContextResult.ok) {
      return NextResponse.json(
        { success: false, error: eventContextResult.error },
        { status: eventContextResult.status }
      )
    }

    const loadSlots: RunBookingAgentInput['loadSlots'] = async ({
      date,
      timezone,
    }) => {
      const result = await loadAvailableSlotsForDate({
        supabase: adminClient,
        hostUserId: parsed.data.hostUserId,
        eventTypeId: parsed.data.eventTypeId,
        date,
        guestTimezone: timezone,
      })

      if (!result.success) return result

      return {
        success: true,
        slots: await addSlotHoldTokens({
          slots: result.slots,
          hostUserId: parsed.data.hostUserId,
          eventTypeId: parsed.data.eventTypeId,
        }),
      }
    }

    try {
      const result = await runBookingAgentTurn({
        request: parsed.data,
        eventContext: eventContextResult.context,
        provider: new ButterbaseBookingAgentProvider(),
        loadSlots,
      } satisfies RunBookingAgentInput)

      return NextResponse.json(result)
    } catch (error) {
      if (error instanceof BookingAgentGatewayError && error.status === 402) {
        console.warn('Butterbase AI gateway unavailable for booking assistant', {
          status: error.status,
          code: error.code,
        })
        return NextResponse.json(
          await runBookingAgentFallbackTurn({
            request: parsed.data,
            loadSlots,
          })
        )
      }

      throw error
    }
  } catch (error) {
    if (error instanceof BookingAgentGatewayError) {
      const status = error.status && error.status >= 400 ? error.status : 502
      return NextResponse.json(
        {
          success: false,
          error:
            status === 401 || status === 403
              ? 'Butterbase AI gateway rejected the booking assistant configuration.'
              : error.message,
        },
        { status }
      )
    }

    console.error('Error in POST /api/booking-agent/message:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function loadBookingAgentEventContext(
  adminClient: AdminClient,
  hostUserId: string,
  eventTypeId: string
): Promise<BookingAgentContextResult> {
  const [
    { data: eventTypeData, error: eventTypeError },
    { data: profileData, error: profileError },
  ] = await Promise.all([
    adminClient
      .from('event_types')
      .select(
        'id, title, description, duration_minutes, location_type, location_value, invitee_questions, user_id, is_active'
      )
      .eq('id', eventTypeId)
      .eq('user_id', hostUserId)
      .eq('is_active', true)
      .single(),
    adminClient
      .from('profiles')
      .select('id, name, username')
      .eq('id', hostUserId)
      .single(),
  ])

  const eventType = eventTypeData as BookingAgentEventType | null
  const profile = profileData as BookingAgentProfile | null

  if (eventTypeError && !isNoRowsError(eventTypeError)) {
    console.error('Failed to load booking assistant event type context', {
      hostUserId,
      eventTypeId,
      error: eventTypeError,
    })
    return {
      ok: false,
      status: 500,
      error: 'Failed to load booking assistant event context',
    }
  }

  if (profileError && !isNoRowsError(profileError)) {
    console.error('Failed to load booking assistant host profile context', {
      hostUserId,
      eventTypeId,
      error: profileError,
    })
    return {
      ok: false,
      status: 500,
      error: 'Failed to load booking assistant event context',
    }
  }

  if (!eventType || !profile) {
    return {
      ok: false,
      status: 404,
      error: 'Event type not found',
    }
  }

  return {
    ok: true,
    context: {
      eventTypeId: eventType.id,
      hostUserId: eventType.user_id,
      hostName: profile.name,
      eventTitle: eventType.title,
      eventDescription: eventType.description,
      durationMinutes: eventType.duration_minutes,
      locationType: eventType.location_type,
      locationValue: eventType.location_value,
      inviteeQuestions: normalizeInviteeQuestions(
        eventType.invitee_questions
      ).map((question) => ({
        id: question.id,
        label: question.label,
        type: question.type,
        required: question.required,
        options: question.options,
      })),
    },
  }
}

function isNoRowsError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'PGRST116'
  )
}
