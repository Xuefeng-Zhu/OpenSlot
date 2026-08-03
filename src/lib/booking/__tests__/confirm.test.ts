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
 * `rpc` is added per test and returns a builder with a `.single()` method.
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
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    status: 'active',
    created_at: '2025-01-15T13:55:00Z',
  }

  const eventTypeLocation = {
    invitee_questions: [],
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
  }

  const rpcRow = {
    booking_id: 'booking-id-1',
    cancellation_token: 'cancel-token-1',
    reschedule_token: 'reschedule-token-1',
    conference_status: 'not_required',
    conference_url: null,
  }

  /**
   * Wires the mock client to return the standard hold + event_types reads and
   * a successful confirm_booking RPC. Tests override individual fields of
   * this to drive the error paths.
   */
  function setupRpcSuccess() {
    const rpcSingle = vi.fn().mockResolvedValue({ data: rpcRow, error: null })
    mockClient.rpc = vi.fn(() => ({ single: rpcSingle }))
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })
    return rpcSingle
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

  it('confirms a booking through the atomic confirm_booking RPC', async () => {
    const rpcSingle = setupRpcSuccess()

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(true)
    expect(result.bookingId).toBe('booking-id-1')
    expect(result.cancellationToken).toBe('cancel-token-1')
    expect(result.rescheduleToken).toBe('reschedule-token-1')
    expect(result.conferenceStatus).toBe('not_required')

    // The RPC is called with the slim arg set; the SQL function reads the
    // rest from the event_types row.
    expect(mockClient.rpc).toHaveBeenCalledWith('confirm_booking', {
      p_hold_token: validInput.holdToken,
      p_guest_name: validInput.guestName,
      p_guest_email: validInput.guestEmail,
      p_guest_timezone: validInput.guestTimezone,
      p_notes: validInput.notes,
      p_booking_answers: [],
    })
    const rpcArg = mockClient.rpc.mock.calls[0][1] as Record<string, unknown>
    expect(rpcArg).not.toHaveProperty('p_conference_status')
    expect(rpcArg).not.toHaveProperty('p_conference_provider')
    expect(rpcArg).not.toHaveProperty('p_location_type')
    expect(rpcArg).not.toHaveProperty('p_location_value')
    expect(rpcArg).not.toHaveProperty('p_event_type_reminder_policy')
    expect(rpcSingle).toHaveBeenCalledTimes(1)

    // The atomic RPC handles booking row, reservation flip, booking_events
    // and outbox_events, so the JS-side helpers must not be called.
    expect(convertHoldReservationToBooking).not.toHaveBeenCalled()
    expect(appendBookingEvent).not.toHaveBeenCalled()
    expect(enqueueBookingConfirmedOutbox).not.toHaveBeenCalled()
    expect(enqueueConfiguredBookingReminderOutbox).not.toHaveBeenCalled()

    // No direct bookings table write in the JS path.
    expect(mockClient.insert).not.toHaveBeenCalled()
    expect(mockClient.update).not.toHaveBeenCalledWith({ status: 'confirmed' })

    // Contact upsert remains the only post-RPC side effect.
    expect(upsertContactFromBooking).toHaveBeenCalledWith(mockClient, {
      bookingId: 'booking-id-1',
      hostUserId: 'host-user-1',
      guestName: 'Jane Doe',
      guestEmail: 'jane@example.com',
      guestTimezone: 'America/New_York',
    })

    // Final provider availability is called BEFORE the RPC with buffer math.
    expect(verifyFinalProviderAvailability).toHaveBeenCalledWith(mockClient, {
      hostUserId: 'host-user-1',
      startAt: '2025-01-15T14:00:00Z',
      endAt: '2025-01-15T14:30:00Z',
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    })
  })

  it('validates and snapshots structured invitee answers via the RPC', async () => {
    setupRpcSuccess()
    mockClient.single.mockReset()
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
    expect(mockClient.rpc).toHaveBeenCalledWith(
      'confirm_booking',
      expect.objectContaining({
        p_booking_answers: [
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
    mockClient.rpc = vi.fn(() => ({ single: vi.fn() }))
    mockClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'No rows found', code: 'PGRST116' },
    })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Hold not found')
    expect(mockClient.rpc).not.toHaveBeenCalled()
  })

  it('returns error and marks hold as expired when hold has expired', async () => {
    const expiredHold = {
      ...activeHold,
      expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
    }

    mockClient.single.mockResolvedValueOnce({
      data: expiredHold,
      error: null,
    })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('expired')
    expect(mockClient.from).toHaveBeenCalledWith('slot_holds')
    expect(mockClient.update).toHaveBeenCalledWith({ status: 'expired' })
    expect(expireHoldReservation).toHaveBeenCalledWith(mockClient, 'hold-id-1')
  })

  it('rejects confirmation when the final provider check finds a calendar conflict', async () => {
    vi.mocked(verifyFinalProviderAvailability).mockResolvedValueOnce({
      success: false,
      status: 409,
      error:
        'This slot conflicts with a connected calendar event. Please select a different time.',
    })
    mockClient.rpc = vi.fn(() => ({ single: vi.fn() }))
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('connected calendar event')
    expect(mockClient.rpc).not.toHaveBeenCalled()
  })

  it('rejects confirmation when stale calendar state cannot be verified', async () => {
    vi.mocked(verifyFinalProviderAvailability).mockResolvedValueOnce({
      success: false,
      status: 503,
      error:
        'Could not verify connected calendar availability. Please try again.',
    })
    mockClient.rpc = vi.fn(() => ({ single: vi.fn() }))
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Could not verify connected calendar')
    expect(mockClient.rpc).not.toHaveBeenCalled()
  })

  it('maps a 23P01 RPC error to "booked by someone else"', async () => {
    mockClient.rpc = vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Exclusion constraint violated', code: '23P01' },
      }),
    }))
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toContain('booked by someone else')
  })

  it('maps hold_already_used RPC errors to "Hold not found or already used"', async () => {
    mockClient.rpc = vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'hold_already_used: hold is no longer active' },
      }),
    }))
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Hold not found or already used')
  })

  it('maps hold_expired RPC errors to "Hold has expired. Please select a new slot."', async () => {
    mockClient.rpc = vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'hold_expired: hold is past expires_at' },
      }),
    }))
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Hold has expired. Please select a new slot.')
  })

  it('maps event_type_not_found RPC errors to "Failed to load event type."', async () => {
    mockClient.rpc = vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'event_type_not_found: no active event type' },
      }),
    }))
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Failed to load event type.')
  })

  it('maps unknown RPC errors to "Failed to create booking."', async () => {
    mockClient.rpc = vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Connection timeout', code: '57014' },
      }),
    }))
    mockClient.single
      .mockResolvedValueOnce({ data: activeHold, error: null })
      .mockResolvedValueOnce({ data: eventTypeLocation, error: null })

    const result = await confirmBooking(validInput, mockClient)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Failed to create booking.')
  })
})
