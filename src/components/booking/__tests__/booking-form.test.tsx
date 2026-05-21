import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingForm } from '../booking-form'

describe('BookingForm', () => {
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
})
