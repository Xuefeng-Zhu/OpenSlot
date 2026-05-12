import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelBooking } from '../cancel'
import type { CancelBookingInput } from '../types'

function createMockClient() {
  return {
    rpc: vi.fn(),
  }
}

describe('cancelBooking', () => {
  let mockClient: ReturnType<typeof createMockClient>

  const validInput: CancelBookingInput = {
    cancellationToken: 'cancel-token-abc-123',
    cancelReason: 'Schedule conflict',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = createMockClient()
  })

  it('cancels a confirmed booking through the atomic transition RPC', async () => {
    mockClient.rpc.mockResolvedValue({
      data: [
        {
          success: true,
          error_code: null,
          booking_id: 'booking-id-1',
        },
      ],
      error: null,
    })

    const result = await cancelBooking(validInput, mockClient as any)

    expect(result).toEqual({ success: true })
    expect(mockClient.rpc).toHaveBeenCalledWith('cancel_booking_by_token', {
      p_cancellation_token: validInput.cancellationToken,
      p_cancel_reason: validInput.cancelReason,
    })
    expect(mockClient.rpc).toHaveBeenCalledTimes(1)
  })

  it('passes null cancel_reason when the guest omits a reason', async () => {
    mockClient.rpc.mockResolvedValue({
      data: [
        {
          success: true,
          error_code: null,
          booking_id: 'booking-id-1',
        },
      ],
      error: null,
    })

    await cancelBooking(
      { cancellationToken: validInput.cancellationToken },
      mockClient as any
    )

    expect(mockClient.rpc).toHaveBeenCalledWith('cancel_booking_by_token', {
      p_cancellation_token: validInput.cancellationToken,
      p_cancel_reason: null,
    })
  })

  it('returns an error when the booking is not found', async () => {
    mockClient.rpc.mockResolvedValue({
      data: [
        {
          success: false,
          error_code: 'booking_not_found',
          booking_id: null,
        },
      ],
      error: null,
    })

    const result = await cancelBooking(validInput, mockClient as any)

    expect(result).toEqual({
      success: false,
      error: 'Booking not found',
    })
  })

  it('returns an idempotent conflict when a concurrent request already cancelled the booking', async () => {
    mockClient.rpc.mockResolvedValue({
      data: [
        {
          success: false,
          error_code: 'booking_already_cancelled',
          booking_id: 'booking-id-1',
        },
      ],
      error: null,
    })

    const result = await cancelBooking(validInput, mockClient as any)

    expect(result).toEqual({
      success: false,
      error: 'Booking has already been cancelled',
    })
  })

  it('fails the cancellation when an injected transactional write fails', async () => {
    mockClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'reservation_not_found', code: 'P0002' },
    })

    const result = await cancelBooking(validInput, mockClient as any)

    expect(result).toEqual({
      success: false,
      error: 'Failed to cancel booking',
    })
  })

  it('fails safely when the RPC returns no transition row', async () => {
    mockClient.rpc.mockResolvedValue({
      data: [],
      error: null,
    })

    const result = await cancelBooking(validInput, mockClient as any)

    expect(result).toEqual({
      success: false,
      error: 'Failed to cancel booking',
    })
  })
})
