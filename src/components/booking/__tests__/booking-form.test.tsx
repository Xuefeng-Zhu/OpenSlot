import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookingForm } from '../booking-form'

describe('BookingForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a pending hold state before the hold token arrives', () => {
    render(
      <BookingForm
        holdPending
        selectedSlot={{
          start: '2026-05-15T17:00:00.000Z',
          end: '2026-05-15T17:30:00.000Z',
        }}
        eventTitle="Discovery Call"
        hostName="Sarah Chen"
        timezone="America/Los_Angeles"
        inviteeQuestions={[]}
        onConfirmed={vi.fn()}
        onHoldExpired={vi.fn()}
        onSlotTaken={vi.fn()}
      />
    )

    expect(screen.getByRole('status')).toHaveProperty(
      'textContent',
      'Securing time...'
    )
    expect(
      screen.getByRole('button', { name: 'Securing Time...' })
    ).toHaveProperty('disabled', true)
    expect(screen.queryByRole('timer')).toBeNull()
  })

  it('renders configured invitee questions in the public booking form', () => {
    render(
      <BookingForm
        holdToken="550e8400-e29b-41d4-a716-446655440000"
        expiresAt={new Date(Date.now() + 5 * 60 * 1000).toISOString()}
        selectedSlot={{
          start: '2026-05-15T17:00:00.000Z',
          end: '2026-05-15T17:30:00.000Z',
        }}
        eventTitle="Discovery Call"
        hostName="Sarah Chen"
        timezone="America/Los_Angeles"
        inviteeQuestions={[
          {
            id: 'topic',
            label: 'What should we discuss?',
            type: 'textarea',
            required: true,
            options: [],
          },
          {
            id: 'send-summary',
            label: 'Send a summary afterward',
            type: 'checkbox',
            required: false,
            options: [],
          },
        ]}
        onConfirmed={vi.fn()}
        onHoldExpired={vi.fn()}
        onSlotTaken={vi.fn()}
      />
    )

    expect(screen.getByLabelText('What should we discuss? *')).toBeDefined()
    expect(screen.getByLabelText('Send a summary afterward')).toBeDefined()
  })

  it('prefills guest details from the booking assistant draft', () => {
    render(
      <BookingForm
        holdToken="550e8400-e29b-41d4-a716-446655440000"
        expiresAt={new Date(Date.now() + 5 * 60 * 1000).toISOString()}
        selectedSlot={{
          start: '2026-05-15T17:00:00.000Z',
          end: '2026-05-15T17:30:00.000Z',
        }}
        eventTitle="Discovery Call"
        hostName="Sarah Chen"
        timezone="America/Los_Angeles"
        inviteeQuestions={[]}
        initialDraft={{
          guestName: 'Jane Doe',
          guestEmail: 'jane@example.com',
          notes: 'I want to discuss onboarding.',
        }}
        onConfirmed={vi.fn()}
        onHoldExpired={vi.fn()}
        onSlotTaken={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Name *')).toHaveProperty('value', 'Jane Doe')
    expect(screen.getByLabelText('Email *')).toHaveProperty(
      'value',
      'jane@example.com'
    )
    expect(screen.getByLabelText('Notes (optional)')).toHaveProperty(
      'value',
      'I want to discuss onboarding.'
    )
  })

  it('applies assistant draft updates after the form has mounted', () => {
    const props = {
      holdToken: '550e8400-e29b-41d4-a716-446655440000',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      selectedSlot: {
        start: '2026-05-15T17:00:00.000Z',
        end: '2026-05-15T17:30:00.000Z',
      },
      eventTitle: 'Discovery Call',
      hostName: 'Sarah Chen',
      timezone: 'America/Los_Angeles',
      inviteeQuestions: [
        {
          id: 'topic',
          label: 'What should we discuss?',
          type: 'textarea',
          required: true,
          options: [],
        },
      ],
      onConfirmed: vi.fn(),
      onHoldExpired: vi.fn(),
      onSlotTaken: vi.fn(),
    } satisfies ComponentProps<typeof BookingForm>
    const { rerender } = render(<BookingForm {...props} />)

    expect(screen.getByLabelText('Name *')).toHaveProperty('value', '')
    expect(screen.getByLabelText('What should we discuss? *')).toHaveProperty(
      'value',
      ''
    )

    rerender(
      <BookingForm
        {...props}
        initialDraft={{
          guestName: 'Jane Doe',
          guestEmail: 'jane@example.com',
          notes: 'I want to discuss onboarding.',
          answers: {
            topic: 'Implementation details',
          },
        }}
      />
    )

    expect(screen.getByLabelText('Name *')).toHaveProperty('value', 'Jane Doe')
    expect(screen.getByLabelText('Email *')).toHaveProperty(
      'value',
      'jane@example.com'
    )
    expect(screen.getByLabelText('Notes (optional)')).toHaveProperty(
      'value',
      'I want to discuss onboarding.'
    )
    expect(screen.getByLabelText('What should we discuss? *')).toHaveProperty(
      'value',
      'Implementation details'
    )
  })

  it('does not overwrite guest-edited fields with later assistant drafts', () => {
    const props = {
      holdToken: '550e8400-e29b-41d4-a716-446655440000',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      selectedSlot: {
        start: '2026-05-15T17:00:00.000Z',
        end: '2026-05-15T17:30:00.000Z',
      },
      eventTitle: 'Discovery Call',
      hostName: 'Sarah Chen',
      timezone: 'America/Los_Angeles',
      inviteeQuestions: [
        {
          id: 'topic',
          label: 'What should we discuss?',
          type: 'textarea',
          required: true,
          options: [],
        },
      ],
      onConfirmed: vi.fn(),
      onHoldExpired: vi.fn(),
      onSlotTaken: vi.fn(),
    } satisfies ComponentProps<typeof BookingForm>
    const { rerender } = render(<BookingForm {...props} />)

    fireEvent.change(screen.getByLabelText('Name *'), {
      target: { value: 'Alex Guest' },
    })
    fireEvent.change(screen.getByLabelText('Email *'), {
      target: { value: 'alex@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Notes (optional)'), {
      target: { value: 'Please use the manual note.' },
    })
    fireEvent.change(screen.getByLabelText('Notes (optional)'), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByLabelText('What should we discuss? *'), {
      target: { value: 'Manual topic' },
    })
    fireEvent.change(screen.getByLabelText('What should we discuss? *'), {
      target: { value: '' },
    })

    rerender(
      <BookingForm
        {...props}
        initialDraft={{
          guestName: 'Jane Doe',
          guestEmail: 'jane@example.com',
          notes: 'Assistant note',
          answers: {
            topic: 'Assistant topic',
          },
        }}
      />
    )

    expect(screen.getByLabelText('Name *')).toHaveProperty(
      'value',
      'Alex Guest'
    )
    expect(screen.getByLabelText('Email *')).toHaveProperty(
      'value',
      'alex@example.com'
    )
    expect(screen.getByLabelText('Notes (optional)')).toHaveProperty(
      'value',
      ''
    )
    expect(screen.getByLabelText('What should we discuss? *')).toHaveProperty(
      'value',
      ''
    )
  })

  it('keeps the booking timezone hidden in the confirmation form', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          bookingId: 'booking-1',
          cancellationToken: 'cancel-token',
          startAt: '2026-05-15T17:00:00.000Z',
          endAt: '2026-05-15T17:30:00.000Z',
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <BookingForm
        holdToken="550e8400-e29b-41d4-a716-446655440000"
        expiresAt={new Date(Date.now() + 5 * 60 * 1000).toISOString()}
        selectedSlot={{
          start: '2026-05-15T17:00:00.000Z',
          end: '2026-05-15T17:30:00.000Z',
        }}
        eventTitle="Discovery Call"
        hostName="Sarah Chen"
        timezone="America/Los_Angeles"
        inviteeQuestions={[]}
        onConfirmed={vi.fn()}
        onHoldExpired={vi.fn()}
        onSlotTaken={vi.fn()}
      />
    )

    expect(screen.queryByLabelText('Timezone')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()

    fireEvent.change(screen.getByLabelText('Name *'), {
      target: { value: 'Alex Guest' },
    })
    fireEvent.change(screen.getByLabelText('Email *'), {
      target: { value: 'alex@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const requestBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body)
    ) as { guestTimezone?: string }
    expect(requestBody.guestTimezone).toBe('America/Los_Angeles')
  })

  it('falls back to the page timezone for invalid assistant draft timezones', () => {
    const { container } = render(
      <BookingForm
        holdToken="550e8400-e29b-41d4-a716-446655440000"
        expiresAt={new Date(Date.now() + 5 * 60 * 1000).toISOString()}
        selectedSlot={{
          start: '2026-05-15T17:00:00.000Z',
          end: '2026-05-15T17:30:00.000Z',
        }}
        eventTitle="Discovery Call"
        hostName="Sarah Chen"
        timezone="America/Los_Angeles"
        inviteeQuestions={[]}
        initialDraft={{
          guestTimezone: 'Eastern Time',
        }}
        onConfirmed={vi.fn()}
        onHoldExpired={vi.fn()}
        onSlotTaken={vi.fn()}
      />
    )

    expect(screen.getByText('Friday, May 15, 2026')).toBeDefined()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(
      container.querySelector<HTMLInputElement>('input[name="guestTimezone"]')
        ?.value
    ).toBe('America/Los_Angeles')
  })

  it('keeps valid assistant draft timezones from replacing the page timezone', () => {
    const { container } = render(
      <BookingForm
        holdToken="550e8400-e29b-41d4-a716-446655440000"
        expiresAt={new Date(Date.now() + 5 * 60 * 1000).toISOString()}
        selectedSlot={{
          start: '2026-05-15T17:00:00.000Z',
          end: '2026-05-15T17:30:00.000Z',
        }}
        eventTitle="Discovery Call"
        hostName="Sarah Chen"
        timezone="America/Los_Angeles"
        inviteeQuestions={[]}
        initialDraft={{
          guestTimezone: 'America/New_York',
        }}
        onConfirmed={vi.fn()}
        onHoldExpired={vi.fn()}
        onSlotTaken={vi.fn()}
      />
    )

    expect(screen.getByText('Friday, May 15, 2026')).toBeDefined()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(
      container.querySelector<HTMLInputElement>('input[name="guestTimezone"]')
        ?.value
    ).toBe('America/Los_Angeles')
  })
})
