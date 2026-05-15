import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BookingsClient from '../bookings-client'
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

describe('BookingsClient', () => {
  it('renders a compact searchable event type filter backed by available booking event types', () => {
    const { container } = render(
      <BookingsClient
        bookings={[
          booking(),
          booking({
            id: 'booking-2',
            guest_name: 'Grace Hopper',
            guest_email: 'grace@example.com',
            event_type_title: 'Intro Call',
          }),
        ]}
      />
    )

    const filter = screen.getByLabelText('Filter by event type') as HTMLInputElement
    const filterWrapper = filter.closest('div')
    const options = Array.from(
      container.querySelectorAll<HTMLOptionElement>('#event-type-filter-options option')
    ).map((option) => option.getAttribute('value'))

    expect(filter.getAttribute('list')).toBe('event-type-filter-options')
    expect(filterWrapper?.classList.contains('sm:w-72')).toBe(true)
    expect(options).toEqual(['Design Review', 'Intro Call'])

    fireEvent.change(filter, { target: { value: 'Intro' } })

    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Ada Lovelace')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Clear event type filter' })).toBeDefined()
  })

  it('disables the event type filter when there are no bookings to filter', () => {
    render(<BookingsClient bookings={[]} />)

    const filter = screen.getByLabelText('Filter by event type') as HTMLInputElement

    expect(filter.disabled).toBe(true)
    expect(filter.getAttribute('placeholder')).toBe('No event types to filter')
  })

  it('shows structured answers in the booking detail drawer', () => {
    render(
      <BookingsClient
        bookings={[
          booking({
            booking_answers: [
              {
                questionId: 'topic',
                label: 'What should we discuss?',
                type: 'textarea',
                required: true,
                value: 'Roadmap tradeoffs',
              },
            ],
          }),
        ]}
      />
    )

    fireEvent.click(
      screen.getAllByRole('button', { name: 'View booking with Ada Lovelace' })[0]
    )

    expect(screen.getByText('What should we discuss?')).toBeDefined()
    expect(screen.getByText('Roadmap tradeoffs')).toBeDefined()
  })
})
