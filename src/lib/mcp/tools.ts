import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { TimeSlot } from '@/lib/availability/types'
import { addSlotHoldTokens } from '@/lib/availability/slot-token'
import {
  loadAvailableSlotsForDateRange,
  validateHoldSlotRequest,
} from '@/lib/availability/available-slots'
import { confirmBooking } from '@/lib/booking/confirm'
import { cancelBooking } from '@/lib/booking/cancel'
import { rescheduleBooking } from '@/lib/booking/reschedule'
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
  type PublicRateLimitResult,
} from '@/lib/security/rate-limit'
import type { Database, Json, Tables } from '@/lib/types/database'
import {
  cancelBookingSchema,
  confirmBookingSchema,
  createHoldSchema,
  rescheduleBookingSchema,
} from '@/lib/validations/booking'
import { isValidTimezone } from '@/lib/validations/profile'
import type { McpTokenAuth } from './tokens'
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE } from './tokens'
import { z } from 'zod'

type JsonSchema = Record<string, unknown>

export interface McpToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  annotations?: {
    title?: string
    readOnlyHint?: boolean
    destructiveHint?: boolean
    idempotentHint?: boolean
  }
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export interface McpToolContext {
  adminClient: BackendCompatClient<Database>
  auth: McpTokenAuth
  request: Request
}

type McpToolHandler = (
  argumentsValue: unknown,
  context: McpToolContext
) => Promise<McpToolResult>

type ProfileRow = Pick<
  Tables<'profiles'>,
  | 'id'
  | 'name'
  | 'email'
  | 'username'
  | 'default_timezone'
  | 'public_headline'
  | 'public_bio'
  | 'response_time_label'
>

type EventTypeRow = Pick<
  Tables<'event_types'>,
  | 'id'
  | 'title'
  | 'slug'
  | 'description'
  | 'duration_minutes'
  | 'buffer_before_minutes'
  | 'buffer_after_minutes'
  | 'min_notice_minutes'
  | 'max_booking_days_ahead'
  | 'location_type'
  | 'location_value'
  | 'video_provider'
  | 'invitee_questions'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
>

type BookingListRow = Pick<
  Tables<'bookings'>,
  | 'id'
  | 'event_type_id'
  | 'guest_name'
  | 'guest_email'
  | 'guest_timezone'
  | 'start_at'
  | 'end_at'
  | 'status'
  | 'location_type'
  | 'location_value'
  | 'conference_provider'
  | 'conference_url'
  | 'conference_status'
  | 'created_at'
  | 'updated_at'
> & {
  event_types?: { title: string } | null
}

const uuidSchema = z.string().uuid()
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isIsoDate, 'Expected a real YYYY-MM-DD calendar date')
const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(isValidTimezone, 'Expected an IANA timezone')
const optionalIdempotencyKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/)
  .optional()

const getEventTypeArgsSchema = z.object({
  eventTypeId: uuidSchema,
})

const listAvailableSlotsArgsSchema = z
  .object({
    eventTypeId: uuidSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    timezone: timezoneSchema,
  })
  .refine(
    (input) => dateRangeLength(input.startDate, input.endDate) >= 1,
    'endDate must be on or after startDate'
  )
  .refine(
    (input) => dateRangeLength(input.startDate, input.endDate) <= 60,
    'Date range cannot exceed 60 days'
  )

const listBookingsArgsSchema = z
  .object({
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    status: z.enum(['confirmed', 'cancelled']).optional(),
    limit: z.number().int().min(1).max(100).optional().default(20),
  })
  .refine(
    (input) =>
      !input.startDate ||
      !input.endDate ||
      dateRangeLength(input.startDate, input.endDate) >= 1,
    'endDate must be on or after startDate'
  )

const createHoldArgsSchema = createHoldSchema
  .omit({ hostUserId: true, turnstileToken: true, slotToken: true })
  .extend({ idempotencyKey: optionalIdempotencyKeySchema })

const confirmBookingArgsSchema = confirmBookingSchema
  .omit({ turnstileToken: true })
  .extend({ idempotencyKey: optionalIdempotencyKeySchema })

const cancelBookingArgsSchema = cancelBookingSchema
  .omit({ cancellationToken: true, turnstileToken: true })
  .extend({
    bookingId: uuidSchema,
    idempotencyKey: optionalIdempotencyKeySchema,
  })

const rescheduleBookingArgsSchema = rescheduleBookingSchema
  .omit({ rescheduleToken: true, turnstileToken: true })
  .extend({
    bookingId: uuidSchema,
    idempotencyKey: optionalIdempotencyKeySchema,
  })

const toolDefinitions: McpToolDefinition[] = [
  {
    name: 'openslot_get_profile',
    title: 'Get Profile',
    description: 'Return the authenticated OpenSlot host profile.',
    inputSchema: objectSchema({}),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'openslot_list_event_types',
    title: 'List Event Types',
    description: 'List event types owned by the authenticated OpenSlot host.',
    inputSchema: objectSchema({}),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'openslot_get_event_type',
    title: 'Get Event Type',
    description: 'Return one event type owned by the authenticated host.',
    inputSchema: objectSchema({
      eventTypeId: stringSchema('OpenSlot event type UUID'),
    }, ['eventTypeId']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'openslot_list_available_slots',
    title: 'List Available Slots',
    description: 'Compute available booking slots for one host event type.',
    inputSchema: objectSchema(
      {
        eventTypeId: stringSchema('OpenSlot event type UUID'),
        startDate: stringSchema('Start date as YYYY-MM-DD'),
        endDate: stringSchema('End date as YYYY-MM-DD'),
        timezone: stringSchema('Guest IANA timezone'),
      },
      ['eventTypeId', 'startDate', 'endDate', 'timezone']
    ),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'openslot_list_bookings',
    title: 'List Bookings',
    description: 'List bookings for the authenticated host without booking tokens.',
    inputSchema: objectSchema({
      startDate: stringSchema('Optional start date as YYYY-MM-DD'),
      endDate: stringSchema('Optional end date as YYYY-MM-DD'),
      status: enumSchema(['confirmed', 'cancelled']),
      limit: numberSchema('Maximum bookings to return, 1 to 100'),
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'openslot_create_booking_hold',
    title: 'Create Booking Hold',
    description: 'Create a temporary hold for a host event type slot.',
    inputSchema: objectSchema(
      {
        eventTypeId: stringSchema('OpenSlot event type UUID'),
        startAt: stringSchema('Slot start as ISO 8601 datetime'),
        endAt: stringSchema('Slot end as ISO 8601 datetime'),
        guestEmail: stringSchema('Guest email address'),
        idempotencyKey: stringSchema('Optional retry-safe idempotency key'),
      },
      ['eventTypeId', 'startAt', 'endAt', 'guestEmail']
    ),
    annotations: { idempotentHint: true },
  },
  {
    name: 'openslot_confirm_booking',
    title: 'Confirm Booking',
    description: 'Confirm a booking from an active OpenSlot hold token.',
    inputSchema: objectSchema(
      {
        holdToken: stringSchema('OpenSlot hold token UUID'),
        guestName: stringSchema('Guest display name'),
        guestEmail: stringSchema('Guest email address'),
        guestTimezone: stringSchema('Guest IANA timezone'),
        notes: stringSchema('Optional guest notes'),
        answers: { type: 'object', additionalProperties: true },
        idempotencyKey: stringSchema('Optional retry-safe idempotency key'),
      },
      ['holdToken', 'guestName', 'guestEmail', 'guestTimezone']
    ),
    annotations: { idempotentHint: true },
  },
  {
    name: 'openslot_cancel_booking',
    title: 'Cancel Booking',
    description: 'Cancel a confirmed booking owned by the authenticated host.',
    inputSchema: objectSchema(
      {
        bookingId: stringSchema('OpenSlot booking UUID'),
        cancelReason: stringSchema('Optional cancellation reason'),
        idempotencyKey: stringSchema('Optional retry-safe idempotency key'),
      },
      ['bookingId']
    ),
    annotations: { destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'openslot_reschedule_booking',
    title: 'Reschedule Booking',
    description: 'Reschedule a host booking by consuming a fresh hold token.',
    inputSchema: objectSchema(
      {
        bookingId: stringSchema('OpenSlot booking UUID'),
        holdToken: stringSchema('New hold token UUID'),
        guestName: stringSchema('Guest display name'),
        guestEmail: stringSchema('Guest email address'),
        guestTimezone: stringSchema('Guest IANA timezone'),
        notes: stringSchema('Optional guest notes'),
        answers: { type: 'object', additionalProperties: true },
        idempotencyKey: stringSchema('Optional retry-safe idempotency key'),
      },
      ['bookingId', 'holdToken', 'guestName', 'guestEmail', 'guestTimezone']
    ),
    annotations: { idempotentHint: true },
  },
]

const toolHandlers: Record<string, McpToolHandler> = {
  openslot_get_profile: handleGetProfile,
  openslot_list_event_types: handleListEventTypes,
  openslot_get_event_type: handleGetEventType,
  openslot_list_available_slots: handleListAvailableSlots,
  openslot_list_bookings: handleListBookings,
  openslot_create_booking_hold: handleCreateBookingHold,
  openslot_confirm_booking: handleConfirmBooking,
  openslot_cancel_booking: handleCancelBooking,
  openslot_reschedule_booking: handleRescheduleBooking,
}

export function listMcpToolsForScopes(scopes: string[]) {
  return toolDefinitions.filter((tool) =>
    isReadOnlyTool(tool) ? scopes.includes(MCP_READ_SCOPE) : scopes.includes(MCP_WRITE_SCOPE)
  )
}

export async function callMcpTool({
  name,
  argumentsValue,
  context,
}: {
  name: string
  argumentsValue: unknown
  context: McpToolContext
}): Promise<McpToolResult> {
  const definition = toolDefinitions.find((tool) => tool.name === name)
  const handler = toolHandlers[name]

  if (!definition || !handler) {
    return toolError(`Unknown tool: ${name}`)
  }

  if (!canUseTool(definition, context.auth.scopes)) {
    return toolError(`Token is not authorized to call ${name}`)
  }

  return handler(argumentsValue ?? {}, context)
}

async function handleGetProfile(
  argumentsValue: unknown,
  { adminClient, auth }: McpToolContext
): Promise<McpToolResult> {
  const parsed = z.object({}).safeParse(argumentsValue)
  if (!parsed.success) return validationToolError(parsed.error)

  const { data, error } = await adminClient
    .from('profiles')
    .select(
      'id, name, email, username, default_timezone, public_headline, public_bio, response_time_label'
    )
    .eq('id', auth.profileId)
    .single()

  if (error || !data) {
    return toolError('Profile not found')
  }

  const profile = toProfileOutput(data as ProfileRow)
  return toolSuccess('Loaded OpenSlot profile.', { profile })
}

async function handleListEventTypes(
  argumentsValue: unknown,
  { adminClient, auth }: McpToolContext
): Promise<McpToolResult> {
  const parsed = z.object({}).safeParse(argumentsValue)
  if (!parsed.success) return validationToolError(parsed.error)

  const { data, error } = await adminClient
    .from('event_types')
    .select(
      'id, title, slug, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_booking_days_ahead, location_type, location_value, video_provider, invitee_questions, is_active, created_at, updated_at'
    )
    .eq('user_id', auth.profileId)
    .order('created_at', { ascending: false })

  if (error) {
    return toolError('Failed to load event types')
  }

  const eventTypes = ((data ?? []) as EventTypeRow[]).map(toEventTypeOutput)
  return toolSuccess(`Loaded ${eventTypes.length} event types.`, { eventTypes })
}

async function handleGetEventType(
  argumentsValue: unknown,
  { adminClient, auth }: McpToolContext
): Promise<McpToolResult> {
  const parsed = getEventTypeArgsSchema.safeParse(argumentsValue)
  if (!parsed.success) return validationToolError(parsed.error)

  const { data, error } = await adminClient
    .from('event_types')
    .select(
      'id, title, slug, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_booking_days_ahead, location_type, location_value, video_provider, invitee_questions, is_active, created_at, updated_at'
    )
    .eq('id', parsed.data.eventTypeId)
    .eq('user_id', auth.profileId)
    .single()

  if (error || !data) {
    return toolError('Event type not found')
  }

  return toolSuccess('Loaded event type.', {
    eventType: toEventTypeOutput(data as EventTypeRow),
  })
}

async function handleListAvailableSlots(
  argumentsValue: unknown,
  { adminClient, auth }: McpToolContext
): Promise<McpToolResult> {
  const parsed = listAvailableSlotsArgsSchema.safeParse(argumentsValue)
  if (!parsed.success) return validationToolError(parsed.error)

  const slotsResult = await loadAvailableSlotsForDateRange({
    backendClient: adminClient,
    hostUserId: auth.profileId,
    eventTypeId: parsed.data.eventTypeId,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    guestTimezone: parsed.data.timezone,
  })

  if (!slotsResult.success) {
    return toolError(slotsResult.error)
  }

  const slotsByDate = await addSlotHoldTokensByDate({
    slotsByDate: slotsResult.slotsByDate,
    hostUserId: auth.profileId,
    eventTypeId: parsed.data.eventTypeId,
  })
  const slotCount = Object.values(slotsByDate).reduce(
    (total, slots) => total + slots.length,
    0
  )

  return toolSuccess(`Loaded ${slotCount} available slots.`, {
    slotsByDate,
  })
}

async function handleListBookings(
  argumentsValue: unknown,
  { adminClient, auth }: McpToolContext
): Promise<McpToolResult> {
  const parsed = listBookingsArgsSchema.safeParse(argumentsValue)
  if (!parsed.success) return validationToolError(parsed.error)

  let query = adminClient
    .from('bookings')
    .select(
      'id, event_type_id, guest_name, guest_email, guest_timezone, start_at, end_at, status, location_type, location_value, conference_provider, conference_url, conference_status, created_at, updated_at, event_types(title)'
    )
    .eq('host_user_id', auth.profileId)
    .order('start_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.status) query = query.eq('status', parsed.data.status)
  if (parsed.data.startDate) {
    query = query.gte('start_at', `${parsed.data.startDate}T00:00:00.000Z`)
  }
  if (parsed.data.endDate) {
    query = query.lte('start_at', `${parsed.data.endDate}T23:59:59.999Z`)
  }

  const { data, error } = await query

  if (error) {
    return toolError('Failed to load bookings')
  }

  const bookings = ((data ?? []) as BookingListRow[]).map(toBookingOutput)
  return toolSuccess(`Loaded ${bookings.length} bookings.`, { bookings })
}

async function handleCreateBookingHold(
  argumentsValue: unknown,
  context: McpToolContext
): Promise<McpToolResult> {
  const parsed = createHoldArgsSchema.safeParse(argumentsValue)
  if (!parsed.success) return validationToolError(parsed.error)

  const holdInput = {
    ...parsed.data,
    hostUserId: context.auth.profileId,
  }

  return runIdempotentMutation({
    adminClient: context.adminClient,
    scope: 'create-hold',
    idempotencyKey: parsed.data.idempotencyKey,
    requestPayload: holdInput,
    execute: async (entry) => {
      if (new Date(holdInput.startAt) >= new Date(holdInput.endAt)) {
        await abandonMcpIdempotency(context.adminClient, entry)
        return toolError('Start time must be before end time')
      }

      const rateLimit = await consumeMcpRateLimit({
        context,
        scope: 'mcp-create-hold',
        limit: 20,
        windowSeconds: 5 * 60,
        identifierParts: [holdInput.eventTypeId],
      })
      if (!rateLimit.allowed) {
        await abandonMcpIdempotency(context.adminClient, entry)
        return rateLimitToolError(rateLimit)
      }

      const slotValidation = await validateHoldSlotRequest({
        backendClient: context.adminClient,
        hostUserId: context.auth.profileId,
        eventTypeId: holdInput.eventTypeId,
        startAt: holdInput.startAt,
        endAt: holdInput.endAt,
      })

      if (!slotValidation.success) {
        return toolError(slotValidation.error)
      }

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
      const { data: hold, error } = await context.adminClient
        .rpc('create_slot_hold_with_reservation', {
          p_event_type_id: holdInput.eventTypeId,
          p_host_user_id: context.auth.profileId,
          p_start_at: holdInput.startAt,
          p_end_at: holdInput.endAt,
          p_guest_email: holdInput.guestEmail,
          p_expires_at: expiresAt,
        })
        .single()

      if (error || !hold) {
        return toolError(holdCreationErrorMessage(error))
      }

      return toolSuccess('Created booking hold.', {
        hold: {
          holdId: (hold as { hold_id: string }).hold_id,
          holdToken: (hold as { hold_token: string }).hold_token,
          expiresAt: (hold as { expires_at: string }).expires_at,
        },
      })
    },
  })
}

async function handleConfirmBooking(
  argumentsValue: unknown,
  context: McpToolContext
): Promise<McpToolResult> {
  const parsed = confirmBookingArgsSchema.safeParse(argumentsValue)
  if (!parsed.success) return validationToolError(parsed.error)

  const { idempotencyKey, ...bookingInput } = parsed.data

  return runIdempotentMutation({
    adminClient: context.adminClient,
    scope: 'confirm-booking',
    idempotencyKey,
    requestPayload: bookingInput,
    execute: async (entry) => {
      const rateLimit = await consumeMcpRateLimit({
        context,
        scope: 'mcp-confirm-booking',
        limit: 30,
        windowSeconds: 5 * 60,
      })
      if (!rateLimit.allowed) {
        await abandonMcpIdempotency(context.adminClient, entry)
        return rateLimitToolError(rateLimit)
      }

      const hold = await loadScopedActiveHold(context, bookingInput.holdToken)
      if (!hold) {
        return toolError('Hold not found or already used')
      }

      const result = await confirmBooking(bookingInput, context.adminClient)

      if (!result.success) {
        return toolError(result.error ?? 'Failed to confirm booking')
      }

      return toolSuccess('Confirmed booking.', {
        booking: {
          bookingId: result.bookingId,
          conferenceStatus: result.conferenceStatus,
          conferenceUrl: result.conferenceUrl,
        },
      })
    },
  })
}

async function handleCancelBooking(
  argumentsValue: unknown,
  context: McpToolContext
): Promise<McpToolResult> {
  const parsed = cancelBookingArgsSchema.safeParse(argumentsValue)
  if (!parsed.success) return validationToolError(parsed.error)

  const requestPayload = parsed.data

  return runIdempotentMutation({
    adminClient: context.adminClient,
    scope: 'mcp-cancel-booking',
    idempotencyKey: parsed.data.idempotencyKey,
    requestPayload,
    execute: async (entry) => {
      const rateLimit = await consumeMcpRateLimit({
        context,
        scope: 'mcp-cancel-booking',
        limit: 30,
        windowSeconds: 5 * 60,
      })
      if (!rateLimit.allowed) {
        await abandonMcpIdempotency(context.adminClient, entry)
        return rateLimitToolError(rateLimit)
      }

      const booking = await loadScopedBookingToken(context, parsed.data.bookingId)
      if (!booking) {
        return toolError('Booking not found')
      }

      const result = await cancelBooking(
        {
          cancellationToken: booking.cancellationToken,
          cancelReason: parsed.data.cancelReason,
        },
        context.adminClient
      )

      if (!result.success) {
        return toolError(result.error ?? 'Failed to cancel booking')
      }

      return toolSuccess('Cancelled booking.', {
        booking: {
          bookingId: parsed.data.bookingId,
          status: 'cancelled',
        },
      })
    },
  })
}

async function handleRescheduleBooking(
  argumentsValue: unknown,
  context: McpToolContext
): Promise<McpToolResult> {
  const parsed = rescheduleBookingArgsSchema.safeParse(argumentsValue)
  if (!parsed.success) return validationToolError(parsed.error)

  const requestPayload = parsed.data

  return runIdempotentMutation({
    adminClient: context.adminClient,
    scope: 'mcp-reschedule-booking',
    idempotencyKey: parsed.data.idempotencyKey,
    requestPayload,
    execute: async (entry) => {
      const rateLimit = await consumeMcpRateLimit({
        context,
        scope: 'mcp-reschedule-booking',
        limit: 30,
        windowSeconds: 5 * 60,
      })
      if (!rateLimit.allowed) {
        await abandonMcpIdempotency(context.adminClient, entry)
        return rateLimitToolError(rateLimit)
      }

      const booking = await loadScopedBookingToken(context, parsed.data.bookingId)
      if (!booking) {
        return toolError('Booking not found')
      }

      const { bookingId: _bookingId, idempotencyKey: _key, ...rescheduleInput } =
        parsed.data
      const result = await rescheduleBooking(
        {
          ...rescheduleInput,
          rescheduleToken: booking.rescheduleToken,
        },
        context.adminClient
      )

      if (!result.success) {
        return toolError(result.error ?? 'Failed to reschedule booking')
      }

      return toolSuccess('Rescheduled booking.', {
        booking: {
          bookingId: result.bookingId,
          previousBookingId: result.previousBookingId,
          startAt: result.startAt,
          endAt: result.endAt,
          previousStartAt: result.previousStartAt,
          previousEndAt: result.previousEndAt,
          conferenceStatus: result.conferenceStatus,
          conferenceUrl: result.conferenceUrl,
        },
      })
    },
  })
}

async function runIdempotentMutation({
  adminClient,
  scope,
  idempotencyKey,
  requestPayload,
  execute,
}: {
  adminClient: BackendCompatClient<Database>
  scope: string
  idempotencyKey?: string
  requestPayload: unknown
  execute: (entry: IdempotencyEntry | null) => Promise<McpToolResult>
}) {
  const keyResult = resolveIdempotencyKey(idempotencyKey, null)
  if (!keyResult.ok) {
    return toolError(keyResult.error)
  }

  let entry: IdempotencyEntry | null = null

  if (keyResult.key) {
    const idempotency = await beginIdempotentRequest({
      adminClient,
      scope,
      key: keyResult.key,
      requestHash: hashRequestPayload(requestPayload),
    })

    if (
      idempotency.type === 'replay' ||
      idempotency.type === 'conflict' ||
      idempotency.type === 'error'
    ) {
      return toolResultFromCachedResponse(idempotency.response)
    }

    entry = idempotency.entry
  }

  const result = await execute(entry)

  if (entry) {
    await completeIdempotentRequest({
      adminClient,
      entry,
      response: {
        body: cachedMcpToolResultBody(result),
        status: result.isError ? 400 : 200,
      },
    })
  }

  return result
}

async function abandonMcpIdempotency(
  adminClient: BackendCompatClient<Database>,
  entry: IdempotencyEntry | null
) {
  if (!entry) return
  await abandonIdempotentRequest({ adminClient, entry })
}

async function consumeMcpRateLimit({
  context,
  scope,
  limit,
  windowSeconds,
  identifierParts = [],
}: {
  context: McpToolContext
  scope: string
  limit: number
  windowSeconds: number
  identifierParts?: string[]
}) {
  return consumePublicRateLimit({
    request: context.request as never,
    adminClient: context.adminClient,
    config: {
      scope,
      limit,
      windowSeconds,
      identifierParts: [
        context.auth.profileId,
        context.auth.tokenId,
        ...identifierParts,
      ],
    },
  })
}

async function loadScopedBookingToken(
  { adminClient, auth }: McpToolContext,
  bookingId: string
) {
  const { data, error } = await adminClient
    .from('bookings')
    .select('id, cancellation_token, reschedule_token')
    .eq('id', bookingId)
    .eq('host_user_id', auth.profileId)
    .single()

  if (error || !data) return null

  const booking = data as Pick<
    Tables<'bookings'>,
    'cancellation_token' | 'reschedule_token'
  >
  return {
    cancellationToken: booking.cancellation_token,
    rescheduleToken: booking.reschedule_token,
  }
}

async function loadScopedActiveHold(
  { adminClient, auth }: McpToolContext,
  holdToken: string
) {
  const { data, error } = await adminClient
    .from('slot_holds')
    .select('id')
    .eq('hold_token', holdToken)
    .eq('host_user_id', auth.profileId)
    .eq('status', 'active')
    .single()

  return error || !data ? null : data
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
    Object.entries(slotsByDate).map(async ([date, slots]) => [
      date,
      await addSlotHoldTokens({ slots, hostUserId, eventTypeId }),
    ])
  )

  return Object.fromEntries(entries)
}

function toProfileOutput(profile: ProfileRow) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    username: profile.username,
    defaultTimezone: profile.default_timezone,
    publicHeadline: profile.public_headline,
    publicBio: profile.public_bio,
    responseTimeLabel: profile.response_time_label,
  }
}

function toEventTypeOutput(eventType: EventTypeRow) {
  return {
    id: eventType.id,
    title: eventType.title,
    slug: eventType.slug,
    description: eventType.description,
    durationMinutes: eventType.duration_minutes,
    bufferBeforeMinutes: eventType.buffer_before_minutes,
    bufferAfterMinutes: eventType.buffer_after_minutes,
    minNoticeMinutes: eventType.min_notice_minutes,
    maxBookingDaysAhead: eventType.max_booking_days_ahead,
    locationType: eventType.location_type,
    locationValue: eventType.location_value,
    videoProvider: eventType.video_provider,
    inviteeQuestions: eventType.invitee_questions,
    isActive: eventType.is_active,
    createdAt: eventType.created_at,
    updatedAt: eventType.updated_at,
  }
}

function toBookingOutput(booking: BookingListRow) {
  return {
    id: booking.id,
    eventTypeId: booking.event_type_id,
    eventTypeTitle: booking.event_types?.title ?? null,
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    guestTimezone: booking.guest_timezone,
    startAt: booking.start_at,
    endAt: booking.end_at,
    status: booking.status,
    locationType: booking.location_type,
    locationValue: booking.location_value,
    conferenceProvider: booking.conference_provider,
    conferenceUrl: booking.conference_url,
    conferenceStatus: booking.conference_status,
    createdAt: booking.created_at,
    updatedAt: booking.updated_at,
  }
}

function canUseTool(tool: McpToolDefinition, scopes: string[]) {
  return isReadOnlyTool(tool)
    ? scopes.includes(MCP_READ_SCOPE)
    : scopes.includes(MCP_WRITE_SCOPE)
}

function isReadOnlyTool(tool: McpToolDefinition) {
  return Boolean(tool.annotations?.readOnlyHint)
}

function toolSuccess(
  text: string,
  structuredContent: Record<string, unknown>
): McpToolResult {
  return {
    content: [{ type: 'text', text }],
    structuredContent,
  }
}

function toolError(
  text: string,
  structuredContent?: Record<string, unknown>
): McpToolResult {
  return {
    content: [{ type: 'text', text }],
    ...(structuredContent ? { structuredContent } : {}),
    isError: true,
  }
}

function validationToolError(error: z.ZodError) {
  return toolError('Validation failed', {
    details: error.flatten().fieldErrors,
  })
}

function rateLimitToolError(
  result: Extract<PublicRateLimitResult, { allowed: false }>
) {
  return toolError(result.error, {
    rateLimit: {
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
      retryAfterSeconds: result.retryAfterSeconds,
    },
  })
}

function cachedMcpToolResultBody(result: McpToolResult): Json {
  return {
    content: result.content,
    structuredContent: result.structuredContent ?? null,
    isError: result.isError === true,
  } as Json
}

function toolResultFromCachedResponse(
  response: { body: unknown; status?: number | null }
): McpToolResult {
  if (isCachedMcpToolResultBody(response.body)) {
    const structuredContent = isRecord(response.body.structuredContent)
      ? response.body.structuredContent
      : undefined
    const isError =
      response.body.isError === true || Number(response.status ?? 0) >= 400

    return {
      content: response.body.content,
      ...(structuredContent ? { structuredContent } : {}),
      ...(isError ? { isError: true } : {}),
    }
  }

  const body = response.body
  const structuredContent =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : { result: body }
  const isError =
    Number(response.status ?? 0) >= 400 ||
    ('success' in structuredContent && structuredContent.success === false)

  return {
    content: [
      {
        type: 'text',
        text: isError
          ? String(structuredContent.error ?? 'Cached MCP request failed')
          : 'Loaded cached MCP response.',
      },
    ],
    structuredContent,
    ...(isError ? { isError: true } : {}),
  }
}

function isCachedMcpToolResultBody(
  body: unknown
): body is {
  content: McpToolResult['content']
  structuredContent?: unknown
  isError?: unknown
} {
  if (!isRecord(body) || !Array.isArray(body.content)) return false

  return body.content.every(
    (item) =>
      isRecord(item) &&
      item.type === 'text' &&
      typeof item.text === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function holdCreationErrorMessage(error: { code?: string; message?: string } | null) {
  if (error?.code === '23P01' || error?.code === '23505') {
    return 'This time slot is currently held by another guest. Please select a different time.'
  }

  if (error?.code === 'P0002') {
    return 'Event type not found'
  }

  if (error?.code === '22023') {
    return 'This time slot is no longer available. Please select a different time.'
  }

  return 'Failed to create hold'
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

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0

  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function objectSchema(
  properties: Record<string, unknown>,
  required: string[] = []
): JsonSchema {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function stringSchema(description: string): JsonSchema {
  return { type: 'string', description }
}

function numberSchema(description: string): JsonSchema {
  return { type: 'number', description }
}

function enumSchema(values: string[]): JsonSchema {
  return { type: 'string', enum: values }
}
