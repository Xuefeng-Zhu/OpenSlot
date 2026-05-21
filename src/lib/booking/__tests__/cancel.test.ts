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
 */
function createMockClient() {
  const mock: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }
  return mock
}

describe('cancelBooking', () => {
  let mockClient: ReturnType<typeof createMockClient>

  const validInput: CancelBookingInput = {
    cancellationToken: 'cancel-token-abc-123',
    cancelReason: 'Schedule conflict',
  }

  const confirmedBooking = {
    id: 'booking-id-1',
    event_type_id: 'event-type-1',
    host_user_id: 'host-user-1',
    guest_name: 'Jane Doe',
    guest_email: 'jane@example.com',
    guest_timezone: 'America/New_York',
    notes: '',
    start_at: '2025-01-15T14:00:00Z',
    end_at: '2025-01-15T14:30:00Z',
    status: 'confirmed',
    cancel_reason: null,
    cancellation_token: 'cancel-token-abc-123',
    reschedule_token: 'reschedule-token-1',
    created_at: '2025-01-14T10:00:00Z',
    updated_at: '2025-01-14T10:00:00Z',
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

  it('successfully cancels a confirmed booking', async () => {
    let singleCallCount = 0
    mockClient.single.mockImplementation(() => {
      singleCallCount++
      if (singleCallCount === 1) {
        // Fetch booking by cancellation token
        return Promise.resolve({ data: confirmedBooking, error: null })
      }
      if (singleCallCount === 2) {
        // Fetch event type title
        return Promise.resolve({ data: { title: '30 Minute Meeting' }, error: null })
      }
      if (singleCallCount === 3) {
        // Fetch host profile
        return Promise.resolve({ data: { name: 'Host User', email: 'host@example.com' }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    // Update call returns no error (non-single terminal)
    mockClient.eq.mockImplementation(() => {
      // For the update().eq() chain, we need to resolve the update promise
      return { ...mockClient, then: (resolve: any) => resolve({ error: null }) }
    })

    // Re-mock to handle the update flow properly
    // The update chain: from('bookings').update({...}).eq('id', booking.id)
    // This doesn't call .single(), it just resolves
    let eqCallCount = 0
    mockClient.eq.mockImplementation((...args: any[]) => {
      eqCallCount++
      // After the update().eq() call, it should resolve with no error
      // But we also need eq() to chain for the select queries
      const result = { ...mockClient }
      // If this is the eq after update (3rd eq call - after from.select.eq.eq for the first query)
      // We need to handle this carefully
      return result
    })

    // Simpler approach: mock the full chain behavior
    mockClient = createMockClient()
    let fromCallCount = 0
    mockClient.from.mockImplementation((table: string) => {
      fromCallCount++
      return mockClient
    })

    singleCallCount = 0
    mockClient.single.mockImplementation(() => {
      singleCallCount++
      if (singleCallCount === 1) {
        return Promise.resolve({ data: confirmedBooking, error: null })
      }
      if (singleCallCount === 2) {
        return Promise.resolve({ data: { title: '30 Minute Meeting' }, error: null })
      }
      if (singleCallCount === 3) {
        return Promise.resolve({ data: { name: 'Host User', email: 'host@example.com' }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    // For the update chain (from.update.eq), it doesn't call single
    // The eq() at the end of update chain should resolve as a promise with { error: null }
    // We handle this by making the mock return a thenable when appropriate
    // Since the code does: await adminClient.from('bookings').update({...}).eq('id', booking.id)
    // The last .eq() call needs to resolve as { error: null }
    
    // Override eq to be both chainable and thenable
    let updateCalled = false
    mockClient.update.mockImplementation((...args: any[]) => {
      updateCalled = true
      return {
        eq: vi.fn().mockResolvedValue({ error: null }),
      }
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(enqueueBookingCancelledOutbox).toHaveBeenCalledWith(mockClient, {
      bookingId: 'booking-id-1',
      eventTypeId: 'event-type-1',
      hostUserId: 'host-user-1',
      startAt: '2025-01-15T14:00:00Z',
      endAt: '2025-01-15T14:30:00Z',
      cancelReasonProvided: true,
    })
    expect(cancelBookingReservation).toHaveBeenCalledWith(mockClient, 'booking-id-1')
    expect(appendBookingEvent).toHaveBeenCalledWith(mockClient, {
      bookingId: 'booking-id-1',
      eventType: 'booking.cancelled',
      actorType: 'guest',
      payload: {
        eventTypeId: 'event-type-1',
        hostUserId: 'host-user-1',
        startAt: '2025-01-15T14:00:00Z',
        endAt: '2025-01-15T14:30:00Z',
        cancelReasonProvided: true,
      },
    })
    expect(touchContactForBookingEvent).toHaveBeenCalledWith(mockClient, {
      hostUserId: 'host-user-1',
      guestEmail: 'jane@example.com',
    })
  })

  it('uses the backend cancel function when the client supports RPCs', async () => {
    mockClient.rpc = vi.fn().mockResolvedValue({ data: [{ success: true }], error: null })
    mockClient.single.mockResolvedValueOnce({
      data: confirmedBooking,
      error: null,
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(mockClient.rpc).toHaveBeenCalledWith('cancel_booking', {
      p_cancellation_token: validInput.cancellationToken,
      p_cancel_reason: validInput.cancelReason,
    })
    expect(mockClient.update).not.toHaveBeenCalled()
    expect(cancelBookingReservation).not.toHaveBeenCalled()
    expect(enqueueBookingCancelledOutbox).toHaveBeenCalledWith(mockClient, {
      bookingId: 'booking-id-1',
      eventTypeId: 'event-type-1',
      hostUserId: 'host-user-1',
      startAt: '2025-01-15T14:00:00Z',
      endAt: '2025-01-15T14:30:00Z',
      cancelReasonProvided: true,
    })
  })

  it('returns error when booking is not found', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'No rows found', code: 'PGRST116' },
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns "already cancelled" error when booking status is already cancelled', async () => {
    const cancelledBooking = {
      ...confirmedBooking,
      status: 'cancelled',
    }

    mockClient.single.mockResolvedValueOnce({
      data: cancelledBooking,
      error: null,
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('already been cancelled')
  })

  it('stores cancel_reason when provided', async () => {
    let singleCallCount = 0
    mockClient.single.mockImplementation(() => {
      singleCallCount++
      if (singleCallCount === 1) {
        return Promise.resolve({ data: confirmedBooking, error: null })
      }
      if (singleCallCount === 2) {
        return Promise.resolve({ data: { title: 'Meeting' }, error: null })
      }
      if (singleCallCount === 3) {
        return Promise.resolve({ data: { name: 'Host', email: 'host@test.com' }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const updateEqMock = vi.fn().mockResolvedValue({ error: null })
    mockClient.update.mockImplementation((data: any) => {
      // Verify cancel_reason is included in the update payload
      expect(data.cancel_reason).toBe('Schedule conflict')
      return { eq: updateEqMock }
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(mockClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelled',
        cancel_reason: 'Schedule conflict',
      })
    )
  })

  it('continues cancellation when outbox enqueue fails non-fatally', async () => {
    vi.mocked(enqueueBookingCancelledOutbox).mockResolvedValueOnce({
      queued: 3,
      duplicates: 0,
      failed: 1,
    })

    let singleCallCount = 0
    mockClient.single.mockImplementation(() => {
      singleCallCount++
      if (singleCallCount === 1) {
        return Promise.resolve({ data: confirmedBooking, error: null })
      }
      if (singleCallCount === 2) {
        return Promise.resolve({ data: { title: 'Meeting' }, error: null })
      }
      if (singleCallCount === 3) {
        return Promise.resolve({ data: { name: 'Host', email: 'host@test.com' }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    mockClient.update.mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }))

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(true)
  })

  it('handles database update errors gracefully', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: confirmedBooking,
      error: null,
    })

    // Update fails with a database error
    mockClient.update.mockImplementation(() => {
      return {
        eq: vi.fn().mockResolvedValue({ error: { message: 'Connection lost', code: '57P01' } }),
      }
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to cancel booking')
  })
})
