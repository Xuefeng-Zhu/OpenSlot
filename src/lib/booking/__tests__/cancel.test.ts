import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cancelBooking } from '../cancel'
import type { CancelBookingInput } from '../types'
import { enqueueBookingCancelledOutbox } from '@/lib/outbox/outbox'
import { cancelBookingReservation } from '@/lib/reservations/host-reservations'
import { touchContactForBookingEvent } from '@/lib/contacts/contacts'
import { appendBookingEvent } from '../events'

// Mock email send functions so they don't interfere with tests
vi.mock('@/lib/email/send', () => ({
  sendCancellationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/outbox/outbox', () => ({
  enqueueBookingCancelledOutbox: vi.fn().mockResolvedValue({
    queued: 4,
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
 * Creates a mock backend client that simulates the chained query builder pattern.
 * Each method returns `this` to allow chaining, except terminal methods like `single()`.
 * `rpc` is added per test.
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

describe('cancelBooking', () => {
  let mockClient: ReturnType<typeof createMockClient>

  const validInput: CancelBookingInput = {
    cancellationToken: 'cancel-token-abc-123',
    cancelReason: 'Schedule conflict',
  }

  const hostIdentityRow = {
    host_user_id: 'host-user-1',
    guest_email: 'jane@example.com',
  }

  /**
   * Wires the mock client so a successful cancel_booking RPC and a matching
   * post-cancel contact pre-fetch both succeed. Tests override individual
   * fields of this to drive the error paths.
   */
  function setupRpcSuccess() {
    mockClient.rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mockClient.maybeSingle.mockResolvedValue({ data: hostIdentityRow, error: null })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(enqueueBookingCancelledOutbox).mockResolvedValue({
      queued: 4,
      duplicates: 0,
      failed: 0,
    })
    vi.mocked(cancelBookingReservation).mockResolvedValue(true)
    vi.mocked(touchContactForBookingEvent).mockResolvedValue(true)
    vi.mocked(appendBookingEvent).mockResolvedValue(true)
    mockClient = createMockClient()
  })

  it('cancels a confirmed booking through the atomic cancel_booking RPC', async () => {
    setupRpcSuccess()

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(mockClient.rpc).toHaveBeenCalledWith('cancel_booking', {
      p_cancellation_token: validInput.cancellationToken,
      p_cancel_reason: validInput.cancelReason,
      p_actor_type: 'guest',
      p_actor_id: null,
    })

    // The atomic RPC handles status flip, reservation release, booking_events
    // and outbox_events, so the JS-side helpers must not be called.
    expect(appendBookingEvent).not.toHaveBeenCalled()
    expect(cancelBookingReservation).not.toHaveBeenCalled()
    expect(enqueueBookingCancelledOutbox).not.toHaveBeenCalled()
    expect(mockClient.update).not.toHaveBeenCalled()
    expect(mockClient.insert).not.toHaveBeenCalled()

    // Contact touch remains the only post-RPC side effect, fed by a minimal
    // host-identity pre-fetch.
    expect(mockClient.from).toHaveBeenCalledWith('bookings')
    expect(mockClient.select).toHaveBeenCalledWith('host_user_id, guest_email')
    expect(touchContactForBookingEvent).toHaveBeenCalledWith(mockClient, {
      hostUserId: 'host-user-1',
      guestEmail: 'jane@example.com',
    })
  })

  it('forwards host-actor inputs to the cancel_booking RPC', async () => {
    setupRpcSuccess()

    const result = await cancelBooking(
      {
        ...validInput,
        actorType: 'host',
        actorId: 'profile-1',
      },
      mockClient
    )

    expect(result.success).toBe(true)
    expect(mockClient.rpc).toHaveBeenCalledWith('cancel_booking', {
      p_cancellation_token: validInput.cancellationToken,
      p_cancel_reason: validInput.cancelReason,
      p_actor_type: 'host',
      p_actor_id: 'profile-1',
    })
  })

  it('still succeeds when the post-cancel contact pre-fetch finds no row', async () => {
    setupRpcSuccess()
    mockClient.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(touchContactForBookingEvent).not.toHaveBeenCalled()
  })

  it('maps booking_not_found RPC errors to "Booking not found"', async () => {
    mockClient.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'booking_not_found: no booking with that token' },
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Booking not found')
  })

  it('maps booking_already_cancelled RPC errors to "Booking has already been cancelled"', async () => {
    mockClient.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'booking_already_cancelled: status is cancelled' },
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Booking has already been cancelled')
  })

  it('maps booking_already_rescheduled RPC errors to "Booking has been rescheduled"', async () => {
    mockClient.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'booking_already_rescheduled: status is rescheduled' },
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Booking has been rescheduled')
  })

  it('maps unknown RPC errors to "Failed to cancel booking"', async () => {
    mockClient.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Connection lost', code: '57P01' },
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Failed to cancel booking')
  })
})
