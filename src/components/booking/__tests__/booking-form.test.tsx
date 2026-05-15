import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingForm } from '../booking-form'

describe('BookingForm', () => {
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
})
