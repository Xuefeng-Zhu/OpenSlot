/**
 * Property 12: confirmBooking goes through the atomic confirm_booking RPC.
 * Validates: Requirements 7.1, 7.2, 7.3
 *
 * The post-refactor `confirmBooking` lib must delegate the booking row write,
 * the `host_reservations` hold-to-booking conversion, the `booking_events`
 * audit append, and the `outbox_events` side-effect enqueue to the single
 * `public.confirm_booking` Postgres function introduced in migration
 * `20260526120000_add_confirm_cancel_booking_functions.sql`.
 *
 * The only JS-side database writes the lib is allowed to perform against the
 * post-refactor contract are:
 *   1. The pre-RPC `slot_holds` select (validation).
 *   2. The pre-RPC `event_types` select (answer validation, final availability
 *      buffer math).
 *   3. The single `rpc('confirm_booking', ...)` call.
 *   4. The best-effort post-RPC `upsertContactFromBooking` call.
 *
 * Everything else (enqueue helpers, `appendBookingEvent`,
 * `convertHoldReservationToBooking`, direct `outbox_events` / `booking_events`
 * / `host_reservations` writes) MUST move through the RPC. This test pins
 * that contract by spying on every legacy helper and asserting it was never
 * touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { confirmBooking } from '../confirm'
import type { ConfirmBookingInput } from '../types'
import {
  enqueueBookingConfirmedOutbox,
  enqueueConfiguredBookingReminderOutbox,
} from '@/lib/outbox/outbox'
import {
  convertHoldReservationToBooking,
  expireHoldReservation,
} from '@/lib/reservations/host-reservations'
import { upsertContactFromBooking } from '@/lib/contacts/contacts'
import { appendBookingEvent } from '../events'
import { verifyFinalProviderAvailability } from '@/lib/calendar/final-availability'

// Suppress email sends; the atomic confirm path does not call them directly.
vi.mock('@/lib/email/send', () => ({
  sendBookingConfirmationToGuest: vi.fn().mockResolvedValue(undefined),
  sendBookingNotificationToHost: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/outbox/outbox', () => ({
  enqueueBookingConfirmedOutbox: vi.fn().mockResolvedValue({
    queued: 0,
    duplicates: 0,
    failed: 0,
  }),
  enqueueConfiguredBookingReminderOutbox: vi.fn().mockResolvedValue({
    queued: 0,
    duplicates: 0,
    failed: 0,
  }),
}))

vi.mock('@/lib/reservations/host-reservations', () => ({
  convertHoldReservationToBooking: vi.fn().mockResolvedValue(true),
  expireHoldReservation: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/contacts/contacts', () => ({
  upsertContactFromBooking: vi.fn().mockResolvedValue(null),
}))

vi.mock('../events', () => ({
  appendBookingEvent: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/calendar/final-availability', () => ({
  verifyFinalProviderAvailability: vi.fn().mockResolvedValue({
    success: true,
    checked: false,
    reason: 'disabled',
  }),
}))

/**
 * Creates a mock backend client that simulates the chained query builder
 * pattern. Each method returns `this` to allow chaining, except terminal
 * methods like `single()` and `maybeSingle()`. `rpc` is added per test.
 */
function createMockClient() {
  const mock: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  }
  return mock
}

describe('Property 12: confirmBooking atomicity contract', () => {
  let mockClient: ReturnType<typeof createMockClient>

  const input: ConfirmBookingInput = {
    holdToken: '550e8400-e29b-41d4-a716-446655440000',
    guestName: 'X',
    guestEmail: 'x@y',
    guestTimezone: 'UTC',
  }

  const activeHold = {
    id: 'h-1',
    event_type_id: 'e-1',
    host_user_id: 'host-1',
    start_at: '2027-01-15T14:00:00Z',
    end_at: '2027-01-15T14:30:00Z',
    guest_email: 'x@y',
    hold_token: '550e8400-e29b-41d4-a716-446655440000',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    status: 'active',
    created_at: '2027-01-15T13:55:00Z',
  }

  const eventType = {
    invitee_questions: [],
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
  }

  const rpcRow = {
    booking_id: 'b-1',
    cancellation_token: 'c-1',
    reschedule_token: 'r-1',
    conference_status: 'not_required',
    conference_url: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(enqueueBookingConfirmedOutbox).mockResolvedValue({
      queued: 0,
      duplicates: 0,
      failed: 0,
    })
    vi.mocked(enqueueConfiguredBookingReminderOutbox).mockResolvedValue({
      queued: 0,
      duplicates: 0,
      failed: 0,
    })
    vi.mocked(convertHoldReservationToBooking).mockResolvedValue(true)
    vi.mocked(expireHoldReservation).mockResolvedValue(true)
    vi.mocked(upsertContactFromBooking).mockResolvedValue(null)
    vi.mocked(appendBookingEvent).mockResolvedValue(true)
    vi.mocked(verifyFinalProviderAvailability).mockResolvedValue({
      success: true,
      checked: false,
      reason: 'disabled',
    })
    mockClient = createMockClient()
  })

  it('routes the entire confirm mutation through public.confirm_booking', async () => {
    const rpcSingle = vi.fn().mockResolvedValue({ data: rpcRow, error: null })
    mockClient.rpc = vi.fn(() => ({ single: rpcSingle }))
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventType, error: null })

    const result = await confirmBooking(input, mockClient)

    expect(result.success).toBe(true)
    expect(result.bookingId).toBe('b-1')

    // The RPC is called exactly once with the slim arg set; the SQL function
    // reads the rest from the event_types row.
    expect(mockClient.rpc).toHaveBeenCalledTimes(1)
    expect(mockClient.rpc).toHaveBeenCalledWith('confirm_booking', {
      p_hold_token: input.holdToken,
      p_guest_name: input.guestName,
      p_guest_email: input.guestEmail,
      p_guest_timezone: input.guestTimezone,
      p_notes: '',
      p_booking_answers: [],
    })
    expect(rpcSingle).toHaveBeenCalledTimes(1)

    // Contract assertions: the lib MUST NOT call any of the legacy JS-side
    // helpers that used to handle booking row / outbox / reservation / audit
    // side effects. The atomic RPC owns all of them now.
    expect(vi.mocked(enqueueBookingConfirmedOutbox)).not.toHaveBeenCalled()
    expect(
      vi.mocked(enqueueConfiguredBookingReminderOutbox)
    ).not.toHaveBeenCalled()
    expect(vi.mocked(appendBookingEvent)).not.toHaveBeenCalled()
    expect(vi.mocked(convertHoldReservationToBooking)).not.toHaveBeenCalled()

    // The lib must not write directly to the side-effect tables either; the
    // RPC owns those writes inside its transaction.
    const fromCalls = vi.mocked(mockClient.from).mock.calls as Array<[string]>
    const insertCalls = fromCalls.filter(([table]) => table === 'outbox_events')
    expect(insertCalls).toHaveLength(0)
    const bookingEventWrites = fromCalls.filter(
      ([table]) => table === 'booking_events'
    )
    expect(bookingEventWrites).toHaveLength(0)
    const reservationWrites = fromCalls.filter(
      ([table]) => table === 'host_reservations'
    )
    expect(reservationWrites).toHaveLength(0)

    // The lib must not call .insert() against any table; the only DB writes
    // it performs are the RPC call and the contact upsert helper (which
    // calls from() inside, so a from() call against contacts is expected
    // below).
    expect(vi.mocked(mockClient.insert)).not.toHaveBeenCalled()

    // Contact upsert remains the only post-RPC JS-side side effect.
    expect(vi.mocked(upsertContactFromBooking)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(upsertContactFromBooking)).toHaveBeenCalledWith(
      mockClient,
      {
        bookingId: 'b-1',
        hostUserId: 'host-1',
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        guestTimezone: input.guestTimezone,
      }
    )
  })
})
