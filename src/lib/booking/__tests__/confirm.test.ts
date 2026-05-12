import { beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmBooking } from '../confirm'
import type { ConfirmBookingInput } from '../types'

function createMockClient() {
  return {
    rpc: vi.fn(),
  }
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

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = createMockClient()
  })

  it('confirms a booking through the atomic transition RPC', async () => {
    mockClient.rpc.mockResolvedValue({
      data: [
        {
          success: true,
          error_code: null,
          booking_id: 'booking-id-1',
          cancellation_token: 'cancel-token-1',
          reschedule_token: 'reschedule-token-1',
        },
      ],
      error: null,
    })

    const result = await confirmBooking(validInput, mockClient as any)

    expect(result).toEqual({
      success: true,
      bookingId: 'booking-id-1',
      cancellationToken: 'cancel-token-1',
      rescheduleToken: 'reschedule-token-1',
    })
    expect(mockClient.rpc).toHaveBeenCalledWith('confirm_booking_from_hold', {
      p_hold_token: validInput.holdToken,
      p_guest_name: validInput.guestName,
      p_guest_email: validInput.guestEmail,
      p_guest_timezone: validInput.guestTimezone,
      p_notes: validInput.notes,
    })
    expect(mockClient.rpc).toHaveBeenCalledTimes(1)
  })

  it('returns an error when the hold was already consumed by a concurrent confirmation', async () => {
    mockClient.rpc.mockResolvedValue({
      data: [
        {
          success: false,
          error_code: 'hold_not_found',
          booking_id: null,
          cancellation_token: null,
          reschedule_token: null,
        },
      ],
      error: null,
    })

    const result = await confirmBooking(validInput, mockClient as any)

    expect(result).toEqual({
      success: false,
      error: 'Hold not found or already used',
    })
  })

  it('returns an error and lets the RPC persist lazy expiration for expired holds', async () => {
    mockClient.rpc.mockResolvedValue({
      data: [
        {
          success: false,
          error_code: 'hold_expired',
          booking_id: null,
          cancellation_token: null,
          reschedule_token: null,
        },
      ],
      error: null,
    })

    const result = await confirmBooking(validInput, mockClient as any)

    expect(result).toEqual({
      success: false,
      error: 'Hold has expired. Please select a new slot.',
    })
    expect(mockClient.rpc).toHaveBeenCalledTimes(1)
  })

  it('maps concurrent booking overlap conflicts to a slot-taken error', async () => {
    mockClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'exclusion constraint violated', code: '23P01' },
    })

    const result = await confirmBooking(validInput, mockClient as any)

    expect(result).toEqual({
      success: false,
      error: 'This slot has been booked by someone else. Please select a different time.',
    })
  })

  it('fails the confirmation when an injected transactional write fails', async () => {
    mockClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'reservation_not_found', code: 'P0002' },
    })

    const result = await confirmBooking(validInput, mockClient as any)

    expect(result).toEqual({
      success: false,
      error: 'Failed to create booking.',
    })
  })

  it('fails safely when the RPC returns an incomplete success row', async () => {
    mockClient.rpc.mockResolvedValue({
      data: [
        {
          success: true,
          error_code: null,
          booking_id: null,
          cancellation_token: null,
          reschedule_token: null,
        },
      ],
      error: null,
    })

    const result = await confirmBooking(validInput, mockClient as any)

    expect(result).toEqual({
      success: false,
      error: 'Failed to create booking.',
    })
  })
})
