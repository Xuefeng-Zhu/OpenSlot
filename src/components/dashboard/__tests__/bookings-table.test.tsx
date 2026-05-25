import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingsTable } from '../bookings-table'
import type { Booking } from '@/lib/booking-utils'

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    guest_name: 'Ada Lovelace',
    guest_email: 'ada@example.com',
    guest_timezone: 'America/Los_Angeles',
    notes: '',
    start_at: '2099-05-09T17:00:00.000Z',
    end_at: '2099-05-09T17:30:00.000Z',
    status: 'confirmed',
    cancellation_token: 'cancel-token',
    event_type_title: 'Design Review',
    ...overrides,
  }
}

describe('BookingsTable', () => {
  it('uses native buttons for booking details instead of interactive rows/cards', () => {
    const onBookingClick = vi.fn()
    const { container } = render(
      <BookingsTable
        bookings={[booking()]}
        category="upcoming"
        onBookingClick={onBookingClick}
      />
    )

    expect(container.querySelectorAll('tr[role="button"]')).toHaveLength(0)
    const detailButtons = screen.getAllByRole('button', {
      name: 'View booking with Ada Lovelace',
    })

    expect(detailButtons.length).toBeGreaterThan(0)
    for (const button of detailButtons) {
      expect(button.tagName).toBe('BUTTON')
    }

    fireEvent.click(detailButtons[0])

    expect(onBookingClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-1' })
    )
  })
})
