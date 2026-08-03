import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { render, cleanup, screen } from '@testing-library/react'
import { createElement } from 'react'
import { DashboardClient } from '../dashboard/dashboard-client'
import type { DashboardClientProps } from '../dashboard/dashboard-client'
import { stringOf } from '@/test/fast-check'

/**
 * Feature: ui-backend-integration, Property 2: Dashboard booking link contains username
 * Validates: Requirements 3.4
 *
 * For any valid username string, the dashboard page SHALL render a booking link
 * that contains that username as a path segment.
 */
describe('Feature: ui-backend-integration, Property 2: Dashboard booking link contains username', () => {
  const usernameArb = stringOf(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-'
    ),
    { minLength: 1, maxLength: 30 }
  )
    .filter((s) => /^[a-z0-9]/.test(s) && /[a-z0-9]$/.test(s))

  it('rendered booking link contains the username as a path segment', () => {
    fc.assert(
      fc.property(usernameArb, (username) => {
        const props: DashboardClientProps = {
          profile: {
            username,
            name: 'Test User',
          },
          upcomingBookings: [],
          activeEventTypeCount: 0,
          availabilityState: 'no_active_event_types',
          bookingLink: `https://openslot.app/${username}`,
        }

        const { container } = render(createElement(DashboardClient, props))

        const textContent = container.textContent || ''

        // The MetricCard for "Booking link" renders value as `/{username}`
        expect(textContent).toContain(`/${username}`)

        cleanup()
      }),
      { numRuns: 100 }
    )
  })

  it('renders dashboard shortcuts as navigable links', () => {
    const props: DashboardClientProps = {
      profile: {
        username: 'test-user',
        name: 'Test User',
      },
      upcomingBookings: [],
      activeEventTypeCount: 1,
      availabilityState: 'configured',
      bookingLink: '/test-user',
    }

    render(createElement(DashboardClient, props))

    const bookingsLink = screen.getByRole('link', {
      name: 'View all bookings',
    })
    const eventTypesLink = screen.getByRole('link', {
      name: 'Manage event types',
    })
    const availabilityLink = screen.getByRole('link', {
      name: 'Manage availability',
    })

    expect(bookingsLink.getAttribute('href')).toBe('/bookings')
    expect(eventTypesLink.getAttribute('href')).toBe('/event-types')
    expect(availabilityLink.getAttribute('href')).toBe('/availability')

    cleanup()
  })

  it.each([
    [
      'configured',
      'Configured',
      'Booking hours are set for at least one active event type.',
      '/availability',
    ],
    [
      'needs_hours',
      'Needs hours',
      'Add hours to a schedule used by an active event type.',
      '/availability',
    ],
    [
      'no_active_event_types',
      'No active types',
      'Create or activate an event type before sharing availability.',
      '/event-types',
    ],
  ] as const)(
    'renders the truthful %s availability state',
    (availabilityState, value, description, href) => {
      render(
        createElement(DashboardClient, {
          profile: { username: 'test-user', name: 'Test User' },
          upcomingBookings: [],
          activeEventTypeCount:
            availabilityState === 'no_active_event_types' ? 0 : 1,
          availabilityState,
          bookingLink: '/test-user',
        })
      )

      expect(screen.getByText(value)).toBeDefined()
      expect(screen.getByText(description)).toBeDefined()
      expect(
        screen
          .getAllByRole('link')
          .some((link) => link.getAttribute('href') === href)
      ).toBe(true)
      expect(screen.queryByText('All systems go')).toBeNull()
      expect(screen.queryByText("You're available to be booked")).toBeNull()

      cleanup()
    }
  )
})
