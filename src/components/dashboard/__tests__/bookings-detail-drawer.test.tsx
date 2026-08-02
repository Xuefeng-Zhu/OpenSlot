import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Booking } from '@/lib/booking-utils'
import { DashboardDisplayPreferencesProvider } from '@/components/dashboard/display-preferences-provider'
import { BookingDetailsDrawer } from '../bookings-detail-drawer'

const booking: Booking = {
  id: 'booking-1',
  guest_name: 'Ada Lovelace',
  guest_email: 'ada@example.com',
  guest_timezone: 'Asia/Tokyo',
  notes: '',
  start_at: '2099-05-09T17:00:00.000Z',
  end_at: '2099-05-09T17:30:00.000Z',
  status: 'confirmed',
  cancellation_token: 'cancel-token',
  event_type_title: 'Design Review',
}

describe('BookingDetailsDrawer', () => {
  it('labels host-formatted time separately from the guest timezone', () => {
    render(
      <DashboardDisplayPreferencesProvider
        preferences={{
          timezone: 'America/Los_Angeles',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '24h',
        }}
      >
        <BookingDetailsDrawer
          booking={booking}
          open
          onClose={vi.fn()}
          onCancelBooking={vi.fn()}
        />
      </DashboardDisplayPreferencesProvider>
    )

    expect(
      screen.getByText(
        'Your time · America/Los_Angeles: 09/05/2099 · 10:00 – 10:30'
      )
    ).toBeDefined()
    expect(screen.getByText('Guest timezone: Asia/Tokyo')).toBeDefined()
  })
})
