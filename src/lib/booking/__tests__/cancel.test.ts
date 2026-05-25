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

function mockConditionalBookingUpdate(
  mockClient: ReturnType<typeof createMockClient>,
  response: { data?: unknown; error: unknown }
) {
  const secondEq = vi.fn().mockResolvedValue(response)
  const firstEq = vi.fn(() => ({ eq: secondEq }))
  mockClient.update.mockImplementation(() => ({ eq: firstEq }))
  return { firstEq, secondEq }
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

    mockConditionalBookingUpdate(mockClient, {
      data: [confirmedBooking],
      error: null,
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

  it('records authenticated host cancellations with the host actor', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: confirmedBooking,
      error: null,
    })
    mockConditionalBookingUpdate(mockClient, {
      data: [confirmedBooking],
      error: null,
    })

    const result = await cancelBooking(
      {
        ...validInput,
        actorType: 'host',
        actorId: 'profile-1',
      },
      mockClient
    )

    expect(result.success).toBe(true)
    expect(appendBookingEvent).toHaveBeenCalledWith(mockClient, {
      bookingId: 'booking-id-1',
      eventType: 'booking.cancelled',
      actorType: 'host',
      actorId: 'profile-1',
      payload: {
        eventTypeId: 'event-type-1',
        hostUserId: 'host-user-1',
        startAt: '2025-01-15T14:00:00Z',
        endAt: '2025-01-15T14:30:00Z',
        cancelReasonProvided: true,
      },
    })
  })

  it('falls back to direct updates when the backend cancel function is unavailable', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockClient.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'Butterbase request failed with 404',
        status: 404,
        details: { error: 'Function not found' },
      },
    })
    mockClient.single.mockResolvedValueOnce({
      data: confirmedBooking,
      error: null,
    }).mockResolvedValueOnce({
      data: confirmedBooking,
      error: null,
    })
    mockConditionalBookingUpdate(mockClient, {
      data: [confirmedBooking],
      error: null,
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(mockClient.rpc).toHaveBeenCalledWith('cancel_booking', {
      p_cancellation_token: validInput.cancellationToken,
      p_cancel_reason: validInput.cancelReason,
    })
    expect(mockClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelled',
        cancel_reason: validInput.cancelReason,
      })
    )
    expect(cancelBookingReservation).toHaveBeenCalledWith(
      mockClient,
      'booking-id-1'
    )
    expect(consoleWarn).toHaveBeenCalledWith(
      'Falling back to non-transactional booking cancellation because the backend function is unavailable:',
      expect.objectContaining({ status: 404 })
    )
    consoleWarn.mockRestore()
  })

  it('falls back to direct updates when the backend cancel function returns an inconclusive gateway failure', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockClient.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'Butterbase request failed with 502',
        status: 502,
        details: null,
      },
    })
    mockClient.single.mockResolvedValueOnce({
      data: confirmedBooking,
      error: null,
    }).mockResolvedValueOnce({
      data: confirmedBooking,
      error: null,
    })
    mockConditionalBookingUpdate(mockClient, {
      data: [confirmedBooking],
      error: null,
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(mockClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelled',
        cancel_reason: validInput.cancelReason,
      })
    )
    expect(consoleWarn).toHaveBeenCalledWith(
      'Falling back to non-transactional booking cancellation because the backend function returned no definitive result:',
      expect.objectContaining({ status: 502 })
    )
    consoleWarn.mockRestore()
  })

  it('finishes side effects when an inconclusive cancel response already changed booking status', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockClient.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'Butterbase request failed with 502',
        status: 502,
        details: null,
      },
    })
    mockClient.single.mockResolvedValueOnce({
      data: confirmedBooking,
      error: null,
    }).mockResolvedValueOnce({
      data: {
        ...confirmedBooking,
        status: 'cancelled',
      },
      error: null,
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(mockClient.update).not.toHaveBeenCalled()
    expect(cancelBookingReservation).not.toHaveBeenCalled()
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
    expect(enqueueBookingCancelledOutbox).toHaveBeenCalledWith(mockClient, {
      bookingId: 'booking-id-1',
      eventTypeId: 'event-type-1',
      hostUserId: 'host-user-1',
      startAt: '2025-01-15T14:00:00Z',
      endAt: '2025-01-15T14:30:00Z',
      cancelReasonProvided: true,
    })
    consoleWarn.mockRestore()
  })

  it('rechecks booking status before fallback cancellation side effects', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockClient.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'Butterbase request failed with 404',
        status: 404,
        details: { error: 'Function not found' },
      },
    })
    mockClient.single.mockResolvedValueOnce({
      data: confirmedBooking,
      error: null,
    }).mockResolvedValueOnce({
      data: null,
      error: { message: 'No rows found', code: 'PGRST116' },
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('already been cancelled')
    expect(mockClient.update).not.toHaveBeenCalled()
    expect(cancelBookingReservation).not.toHaveBeenCalled()
    expect(appendBookingEvent).not.toHaveBeenCalled()
    expect(enqueueBookingCancelledOutbox).not.toHaveBeenCalled()
    consoleWarn.mockRestore()
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

    const secondEqMock = vi.fn().mockResolvedValue({
      data: [confirmedBooking],
      error: null,
    })
    const updateEqMock = vi.fn(() => ({ eq: secondEqMock }))
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

    mockConditionalBookingUpdate(mockClient, {
      data: [confirmedBooking],
      error: null,
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(true)
  })

  it('handles database update errors gracefully', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: confirmedBooking,
      error: null,
    })

    // Update fails with a database error
    mockConditionalBookingUpdate(mockClient, {
      data: null,
      error: { message: 'Connection lost', code: '57P01' },
    })

    const result = await cancelBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to cancel booking')
  })
})
