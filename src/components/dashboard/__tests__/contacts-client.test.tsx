import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ContactsClient } from '../contacts-client'
import type { ContactSummary } from '@/lib/contacts/summaries'

function contact(overrides: Partial<ContactSummary> = {}): ContactSummary {
  return {
    id: 'contact-1',
    displayName: 'Ada Lovelace',
    displayEmail: 'ada@example.com',
    lastGuestTimezone: 'Europe/London',
    firstSeenAt: '2026-05-10T10:00:00.000Z',
    lastSeenAt: '2026-05-12T10:00:00.000Z',
    lastMeetingAt: '2026-05-11T10:00:00.000Z',
    nextMeetingAt: '2026-05-20T10:00:00.000Z',
    totalBookings: 2,
    upcomingCount: 1,
    pastCount: 1,
    cancelledCount: 0,
    rescheduledCount: 0,
    eventTitles: ['Design Review'],
    ...overrides,
  }
}

describe('ContactsClient', () => {
  it('filters contacts by search text and status tabs', () => {
    render(
      <ContactsClient
        contacts={[
          contact(),
          contact({
            id: 'contact-2',
            displayName: 'Grace Hopper',
            displayEmail: 'grace@example.com',
            upcomingCount: 0,
            pastCount: 0,
            cancelledCount: 1,
            eventTitles: ['Intro Call'],
          }),
        ]}
      />
    )

    fireEvent.change(screen.getByLabelText('Search contacts'), {
      target: { value: 'intro' },
    })

    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Ada Lovelace')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Clear contact search' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Cancelled' }))

    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Ada Lovelace')).toHaveLength(0)
  })

  it('renders an empty state when there are no contacts', () => {
    render(<ContactsClient contacts={[]} />)

    expect(screen.getByText('No contacts yet')).toBeDefined()
  })
})
