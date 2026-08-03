import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BookingsClient from '../bookings-client'
import type { Booking } from '@/lib/booking-utils'

const toastMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

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
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    toastMock.mockClear()
  })

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

  it('distinguishes a filtered miss from a genuinely empty booking category', () => {
    render(<BookingsClient bookings={[booking()]} />)

    fireEvent.change(screen.getByLabelText('Filter by event type'), {
      target: { value: 'Unrelated event' },
    })

    expect(screen.getByText('No matching bookings')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))

    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0)
    expect(screen.queryByText('No matching bookings')).toBeNull()
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

  it('shows the cancel fallback when the API returns a non-JSON error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('Unexpected token')
        },
      })
    )

    render(<BookingsClient bookings={[booking()]} />)

    fireEvent.click(
      screen.getAllByRole('button', { name: 'View booking with Ada Lovelace' })[0]
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel booking' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Failed to cancel booking',
          variant: 'destructive',
        })
      )
    })
  })

  it('opens generated meeting links in a new tab from the detail drawer', () => {
    render(
      <BookingsClient
        bookings={[
          booking({
            conference_url: 'https://meet.google.com/abc-defg-hij',
          }),
        ]}
      />
    )

    fireEvent.click(
      screen.getAllByRole('button', { name: 'View booking with Ada Lovelace' })[0]
    )

    const link = screen.getByRole('link', { name: 'Open meeting link' })

    expect(link.getAttribute('href')).toBe('https://meet.google.com/abc-defg-hij')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
