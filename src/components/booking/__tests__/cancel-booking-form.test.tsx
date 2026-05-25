import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CancelBookingForm } from '../cancel-booking-form'

const defaultProps = {
  bookingId: 'booking-1',
  cancellationToken: 'cancel-token',
  eventTitle: 'Design Review',
  hostName: 'Grace Host',
  guestName: 'Ada Guest',
  startAt: '2026-06-15T17:00:00.000Z',
  endAt: '2026-06-15T17:30:00.000Z',
  guestTimezone: 'America/Los_Angeles',
}

describe('CancelBookingForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows the cancellation fallback when the API returns a non-JSON error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('Unexpected token')
        },
      })
    )

    render(<CancelBookingForm {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel booking' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Failed to cancel booking'
      )
    })
  })
})
