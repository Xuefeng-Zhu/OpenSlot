/**
 * Property 13: cancelBooking goes through the atomic cancel_booking RPC.
 * Validates: Requirements 8.1, 8.2, 8.3
 *
 * The post-refactor `cancelBooking` lib must delegate the booking status flip,
 * the `host_reservations` release, the `booking_events` audit append, and the
 * `outbox_events` side-effect enqueue to the single `public.cancel_booking`
 * Postgres function introduced in migration
 * `20260526120000_add_confirm_cancel_booking_functions.sql`.
 *
 * The only JS-side database interactions the lib is allowed to perform are:
 *   1. The single `rpc('cancel_booking', ...)` call.
 *   2. A minimal post-RPC `bookings.select('host_user_id, guest_email')`
 *      pre-fetch that supplies the host identity the contact touch needs.
 *   3. The best-effort post-RPC `touchContactForBookingEvent` call.
 *
 * Everything else (`enqueueBookingCancelledOutbox`, `appendBookingEvent`,
 * `cancelBookingReservation`, direct `outbox_events` / `booking_events` /
 * `host_reservations` writes) MUST move through the RPC. This test pins that
 * contract by spying on every legacy helper and asserting it was never
 * touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cancelBooking } from '../cancel'
import type { CancelBookingInput } from '../types'
import { enqueueBookingCancelledOutbox } from '@/lib/outbox/outbox'
import { cancelBookingReservation } from '@/lib/reservations/host-reservations'
import { touchContactForBookingEvent } from '@/lib/contacts/contacts'
import { appendBookingEvent } from '../events'

// Suppress email sends; the atomic cancel path does not call them directly.
vi.mock('@/lib/email/send', () => ({
  sendCancellationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/outbox/outbox', () => ({
  enqueueBookingCancelledOutbox: vi.fn().mockResolvedValue({
    queued: 0,
    duplicates: 0,
    failed: 0,
  }),
}))

vi.mock('@/lib/reservations/host-reservations', () => ({
  cancelBookingReservation: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/contacts/contacts', () => ({
  touchContactForBookingEvent: vi.fn().mockResolvedValue(true),
}))

vi.mock('../events', () => ({
  appendBookingEvent: vi.fn().mockResolvedValue(true),
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

describe('Property 13: cancelBooking atomicity contract', () => {
  let mockClient: ReturnType<typeof createMockClient>

  const input: CancelBookingInput = {
    cancellationToken: 'tok-cancel-1',
  }

  const hostIdentityRow = {
    host_user_id: 'host-1',
    guest_email: 'guest@example.com',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(enqueueBookingCancelledOutbox).mockResolvedValue({
      queued: 0,
      duplicates: 0,
      failed: 0,
    })
    vi.mocked(cancelBookingReservation).mockResolvedValue(true)
    vi.mocked(touchContactForBookingEvent).mockResolvedValue(true)
    vi.mocked(appendBookingEvent).mockResolvedValue(true)
    mockClient = createMockClient()
  })

  it('routes the entire cancel mutation through public.cancel_booking', async () => {
    mockClient.rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mockClient.maybeSingle.mockResolvedValue({ data: hostIdentityRow, error: null })

    const result = await cancelBooking(input, mockClient)

    expect(result.success).toBe(true)

    // The RPC is called exactly once with the slim arg set; the SQL function
    // reads the rest from the bookings row.
    expect(mockClient.rpc).toHaveBeenCalledTimes(1)
    expect(mockClient.rpc).toHaveBeenCalledWith('cancel_booking', {
      p_cancellation_token: input.cancellationToken,
      p_cancel_reason: null,
      p_actor_type: 'guest',
      p_actor_id: null,
    })

    // Contract assertions: the lib MUST NOT call any of the legacy JS-side
    // helpers that used to handle status flip / outbox / reservation / audit
    // side effects. The atomic RPC owns all of them now.
    expect(vi.mocked(enqueueBookingCancelledOutbox)).not.toHaveBeenCalled()
    expect(vi.mocked(appendBookingEvent)).not.toHaveBeenCalled()
    expect(vi.mocked(cancelBookingReservation)).not.toHaveBeenCalled()

    // The lib must not write directly to the side-effect tables either; the
    // RPC owns those writes inside its transaction.
    const fromCalls = vi.mocked(mockClient.from).mock.calls as Array<[string]>
    const outboxWrites = fromCalls.filter(([table]) => table === 'outbox_events')
    expect(outboxWrites).toHaveLength(0)
    const bookingEventWrites = fromCalls.filter(
      ([table]) => table === 'booking_events'
    )
    expect(bookingEventWrites).toHaveLength(0)
    const reservationUpdates = fromCalls.filter(
      ([table]) => table === 'host_reservations'
    )
    expect(reservationUpdates).toHaveLength(0)

    // The lib must not call .update() at all; the RPC owns the status flip
    // and the reservation release.
    expect(vi.mocked(mockClient.update)).not.toHaveBeenCalled()
    expect(vi.mocked(mockClient.insert)).not.toHaveBeenCalled()

    // The lib DID call .from('bookings').select('host_user_id, guest_email')
    // for the minimal post-RPC contact pre-fetch. Other table reads are not
    // expected.
    expect(mockClient.from).toHaveBeenCalledWith('bookings')
    expect(mockClient.select).toHaveBeenCalledWith('host_user_id, guest_email')

    // Contact touch remains the only post-RPC JS-side side effect, fed by
    // the minimal pre-fetch.
    expect(vi.mocked(touchContactForBookingEvent)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(touchContactForBookingEvent)).toHaveBeenCalledWith(
      mockClient,
      {
        hostUserId: 'host-1',
        guestEmail: 'guest@example.com',
      }
    )
  })
})
