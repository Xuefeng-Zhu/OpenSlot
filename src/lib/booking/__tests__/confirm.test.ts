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

// Mock email send functions so they don't interfere with tests
vi.mock('@/lib/email/send', () => ({
  sendBookingConfirmationToGuest: vi.fn().mockResolvedValue(undefined),
  sendBookingNotificationToHost: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/outbox/outbox', () => ({
  enqueueBookingConfirmedOutbox: vi.fn().mockResolvedValue({
    queued: 4,
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

describe('confirmBooking', () => {
  let mockClient: ReturnType<typeof createMockClient>
  const validInput: ConfirmBookingInput = {
    holdToken: '550e8400-e29b-41d4-a716-446655440000',
    guestName: 'Jane Doe',
    guestEmail: 'jane@example.com',
    guestTimezone: 'America/New_York',
    notes: 'Looking forward to it',
  }

  const activeHold = {
    id: 'hold-id-1',
    event_type_id: 'event-type-1',
    host_user_id: 'host-user-1',
    start_at: '2025-01-15T14:00:00Z',
    end_at: '2025-01-15T14:30:00Z',
    guest_email: 'jane@example.com',
    hold_token: '550e8400-e29b-41d4-a716-446655440000',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min in future
    status: 'active',
    created_at: '2025-01-15T13:55:00Z',
  }

  const createdBooking = {
    id: 'booking-id-1',
    cancellation_token: 'cancel-token-1',
    reschedule_token: 'reschedule-token-1',
    conference_status: 'not_required',
    conference_url: null,
  }

  const eventTypeLocation = {
    location_type: 'custom',
    location_value: 'https://example.com/meeting',
    video_provider: null,
    invitee_questions: [],
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(enqueueBookingConfirmedOutbox).mockResolvedValue({
      queued: 4,
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

  it('successfully confirms a booking from a valid active hold', async () => {
    // Setup: hold fetch succeeds
    let singleCallCount = 0
    mockClient.single.mockImplementation(() => {
      singleCallCount++
      if (singleCallCount === 1) {
        // First single() call: fetch hold
        return Promise.resolve({ data: activeHold, error: null })
      }
      if (singleCallCount === 2) {
        // Second single() call: fetch event type location and question config
        return Promise.resolve({ data: eventTypeLocation, error: null })
      }
      if (singleCallCount === 3) {
        // Third single() call: insert booking
        return Promise.resolve({ data: createdBooking, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    // The update call for hold status (non-single)
    mockClient.eq.mockReturnThis()

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(result.bookingId).toBe('booking-id-1')
    expect(result.cancellationToken).toBe('cancel-token-1')
    expect(result.rescheduleToken).toBe('reschedule-token-1')
    expect(result.conferenceStatus).toBe('not_required')
    expect(mockClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        location_type: 'custom',
        location_value: 'https://example.com/meeting',
        conference_provider: null,
        conference_status: 'not_required',
      })
    )
    expect(enqueueBookingConfirmedOutbox).toHaveBeenCalledWith(mockClient, {
      bookingId: 'booking-id-1',
      eventTypeId: 'event-type-1',
      hostUserId: 'host-user-1',
      startAt: '2025-01-15T14:00:00Z',
      endAt: '2025-01-15T14:30:00Z',
    })
    expect(enqueueConfiguredBookingReminderOutbox).toHaveBeenCalledWith(
      mockClient,
      {
        bookingId: 'booking-id-1',
        eventTypeId: 'event-type-1',
        hostUserId: 'host-user-1',
        startAt: '2025-01-15T14:00:00Z',
        endAt: '2025-01-15T14:30:00Z',
      }
    )
    expect(convertHoldReservationToBooking).toHaveBeenCalledWith(mockClient, {
      holdId: 'hold-id-1',
      bookingId: 'booking-id-1',
    })
    expect(appendBookingEvent).toHaveBeenCalledWith(mockClient, {
      bookingId: 'booking-id-1',
      eventType: 'booking.confirmed',
      payload: {
        eventTypeId: 'event-type-1',
        hostUserId: 'host-user-1',
        startAt: '2025-01-15T14:00:00Z',
        endAt: '2025-01-15T14:30:00Z',
      },
    })
    expect(upsertContactFromBooking).toHaveBeenCalledWith(mockClient, {
      bookingId: 'booking-id-1',
      hostUserId: 'host-user-1',
      guestName: 'Jane Doe',
      guestEmail: 'jane@example.com',
      guestTimezone: 'America/New_York',
    })
    expect(mockClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_answers: [],
      })
    )
    expect(verifyFinalProviderAvailability).toHaveBeenCalledWith(mockClient, {
      hostUserId: 'host-user-1',
      startAt: '2025-01-15T14:00:00Z',
      endAt: '2025-01-15T14:30:00Z',
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    })
  })

  it('uses the backend confirm function when the client supports RPCs', async () => {
    const rpcSingle = vi.fn().mockResolvedValue({
      data: {
        booking_id: createdBooking.id,
        cancellation_token: createdBooking.cancellation_token,
        reschedule_token: createdBooking.reschedule_token,
        conference_status: createdBooking.conference_status,
        conference_url: createdBooking.conference_url,
      },
      error: null,
    })
    mockClient.rpc = vi.fn(() => ({ single: rpcSingle }))
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(result.bookingId).toBe('booking-id-1')
    expect(mockClient.rpc).toHaveBeenCalledWith(
      'confirm_booking',
      expect.objectContaining({
        p_hold_token: validInput.holdToken,
        p_guest_name: validInput.guestName,
        p_guest_email: validInput.guestEmail,
        p_conference_status: 'not_required',
      })
    )
    expect(mockClient.insert).not.toHaveBeenCalled()
    expect(mockClient.update).not.toHaveBeenCalledWith({ status: 'confirmed' })
    expect(convertHoldReservationToBooking).not.toHaveBeenCalled()
    expect(enqueueBookingConfirmedOutbox).toHaveBeenCalledWith(mockClient, {
      bookingId: 'booking-id-1',
      eventTypeId: 'event-type-1',
      hostUserId: 'host-user-1',
      startAt: '2025-01-15T14:00:00Z',
      endAt: '2025-01-15T14:30:00Z',
    })
  })

  it('falls back to direct writes when the backend confirm function is unavailable', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rpcSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'Butterbase request failed with 404',
        status: 404,
        details: { error: 'Function not found' },
      },
    })
    mockClient.rpc = vi.fn(() => ({ single: rpcSingle }))
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })
      .mockResolvedValueOnce({ data: createdBooking, error: null })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(result.bookingId).toBe('booking-id-1')
    expect(mockClient.rpc).toHaveBeenCalledWith(
      'confirm_booking',
      expect.any(Object)
    )
    expect(mockClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        guest_email: validInput.guestEmail,
        status: 'confirmed',
      })
    )
    expect(convertHoldReservationToBooking).toHaveBeenCalledWith(mockClient, {
      holdId: 'hold-id-1',
      bookingId: 'booking-id-1',
    })
    expect(consoleWarn).toHaveBeenCalledWith(
      'Falling back to non-transactional booking confirmation because the backend function is unavailable:',
      expect.objectContaining({ status: 404 })
    )
    consoleWarn.mockRestore()
  })

  it('validates and snapshots structured invitee answers', async () => {
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({
        data: {
          ...eventTypeLocation,
          invitee_questions: [
            {
              id: 'topic',
              label: 'What should we cover?',
              type: 'textarea',
              required: true,
              options: [],
            },
            {
              id: 'newsletter',
              label: 'Send follow-up resources',
              type: 'checkbox',
              required: false,
              options: [],
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: createdBooking, error: null })

    const result = await confirmBooking(
      {
        ...validInput,
        answers: {
          topic: 'Roadmap tradeoffs',
          newsletter: true,
        },
      },
      mockClient
    )

    expect(result.success).toBe(true)
    expect(mockClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_answers: [
          {
            questionId: 'topic',
            label: 'What should we cover?',
            type: 'textarea',
            required: true,
            value: 'Roadmap tradeoffs',
          },
          {
            questionId: 'newsletter',
            label: 'Send follow-up resources',
            type: 'checkbox',
            required: false,
            value: true,
          },
        ],
      })
    )
  })

  it('returns error when hold is not found', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'No rows found', code: 'PGRST116' },
    })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Hold not found')
  })

  it('returns error and marks hold as expired when hold has expired', async () => {
    const expiredHold = {
      ...activeHold,
      expires_at: new Date(Date.now() - 60 * 1000).toISOString(), // 1 min in the past
    }

    mockClient.single.mockResolvedValueOnce({
      data: expiredHold,
      error: null,
    })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('expired')
    // Verify that update was called to mark hold as expired
    expect(mockClient.from).toHaveBeenCalledWith('slot_holds')
    expect(mockClient.update).toHaveBeenCalledWith({ status: 'expired' })
    expect(expireHoldReservation).toHaveBeenCalledWith(mockClient, 'hold-id-1')
  })

  it('returns "slot taken" error when exclusion constraint is violated (code 23P01)', async () => {
    // Hold fetch succeeds
    mockClient.single.mockResolvedValueOnce({
      data: activeHold,
      error: null,
    })

    mockClient.single.mockResolvedValueOnce({
      data: eventTypeLocation,
      error: null,
    })

    // Booking insert fails with exclusion constraint violation
    mockClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Exclusion constraint violated', code: '23P01' },
    })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('booked by someone else')
  })

  it('rejects confirmation when the final provider check finds a calendar conflict', async () => {
    vi.mocked(verifyFinalProviderAvailability).mockResolvedValueOnce({
      success: false,
      status: 409,
      error:
        'This slot conflicts with a connected calendar event. Please select a different time.',
    })
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('connected calendar event')
    expect(mockClient.insert).not.toHaveBeenCalled()
  })

  it('rejects confirmation when stale calendar state cannot be verified', async () => {
    vi.mocked(verifyFinalProviderAvailability).mockResolvedValueOnce({
      success: false,
      status: 503,
      error:
        'Could not verify connected calendar availability. Please try again.',
    })
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Could not verify connected calendar')
    expect(mockClient.insert).not.toHaveBeenCalled()
  })

  it('updates hold status to confirmed after successful booking', async () => {
    let singleCallCount = 0
    mockClient.single.mockImplementation(() => {
      singleCallCount++
      if (singleCallCount === 1) {
        return Promise.resolve({ data: activeHold, error: null })
      }
      if (singleCallCount === 2) {
        return Promise.resolve({ data: eventTypeLocation, error: null })
      }
      if (singleCallCount === 3) {
        return Promise.resolve({ data: createdBooking, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    await confirmBooking(validInput, mockClient)

    // Verify update was called with 'confirmed' status
    expect(mockClient.update).toHaveBeenCalledWith({ status: 'confirmed' })
  })

  it('continues confirmation when outbox enqueue fails non-fatally', async () => {
    vi.mocked(enqueueBookingConfirmedOutbox).mockResolvedValueOnce({
      queued: 3,
      duplicates: 0,
      failed: 1,
    })

    let singleCallCount = 0
    mockClient.single.mockImplementation(() => {
      singleCallCount++
      if (singleCallCount === 1) {
        return Promise.resolve({ data: activeHold, error: null })
      }
      if (singleCallCount === 2) {
        return Promise.resolve({ data: eventTypeLocation, error: null })
      }
      if (singleCallCount === 3) {
        return Promise.resolve({ data: createdBooking, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(result.bookingId).toBe('booking-id-1')
  })

  it('handles general database errors gracefully', async () => {
    // Hold fetch succeeds
    mockClient.single.mockResolvedValueOnce({
      data: activeHold,
      error: null,
    })

    mockClient.single.mockResolvedValueOnce({
      data: eventTypeLocation,
      error: null,
    })

    // Booking insert fails with a general error (not exclusion constraint)
    mockClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Connection timeout', code: '57014' },
    })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to create booking')
  })
})
