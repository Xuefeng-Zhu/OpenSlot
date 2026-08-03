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
  it('filters contacts by search text', () => {
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

    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0)
  })

  it('shows only total meeting counts in the list', () => {
    render(
      <ContactsClient
        contacts={[
          contact({
            totalBookings: 1,
            upcomingCount: 0,
            pastCount: 0,
            cancelledCount: 1,
          }),
        ]}
      />
    )

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByText('1 total')).toBeDefined()
    expect(screen.queryByText('1 cancelled')).toBeNull()
  })

  it('renders an empty state when there are no contacts', () => {
    render(<ContactsClient contacts={[]} />)

    expect(screen.getByText('No contacts yet')).toBeDefined()
  })

  it('distinguishes a filtered miss and restores contacts from the empty state', () => {
    render(<ContactsClient contacts={[contact()]} />)

    fireEvent.change(screen.getByLabelText('Search contacts'), {
      target: { value: 'nobody' },
    })

    expect(screen.getByText('No matching contacts')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0)
    expect(screen.queryByText('No matching contacts')).toBeNull()
  })

  it('renders missing email copy and allows long mobile emails to wrap', () => {
    const longEmail = `${'long-address'.repeat(8)}@example.com`
    const { rerender } = render(
      <ContactsClient contacts={[contact({ displayEmail: '' })]} />
    )

    expect(screen.getAllByText('Email unavailable').length).toBeGreaterThan(0)

    rerender(<ContactsClient contacts={[contact({ displayEmail: longEmail })]} />)
    const mobileEmail = screen
      .getAllByText(longEmail)
      .find((element) => element.tagName === 'SPAN')

    expect(mobileEmail?.classList.contains('break-all')).toBe(true)
    expect(mobileEmail?.closest('p')?.classList.contains('truncate')).toBe(false)
  })
})
