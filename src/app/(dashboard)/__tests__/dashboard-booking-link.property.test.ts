import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { render, cleanup, screen } from '@testing-library/react'
import { createElement } from 'react'
import { DashboardClient } from '../dashboard/dashboard-client'
import type { DashboardClientProps } from '../dashboard/dashboard-client'

/**
 * Feature: ui-backend-integration, Property 2: Dashboard booking link contains username
 * Validates: Requirements 3.4
 *
 * For any valid username string, the dashboard page SHALL render a booking link
 * that contains that username as a path segment.
 */
describe('Feature: ui-backend-integration, Property 2: Dashboard booking link contains username', () => {
  // Generator for valid username strings (alphanumeric + hyphens, URL-safe)
  const usernameArb = fc
    .stringOf(
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

  it('renders dashboard metric shortcuts as navigable links', () => {
    const props: DashboardClientProps = {
      profile: {
        username: 'test-user',
        name: 'Test User',
      },
      upcomingBookings: [],
      activeEventTypeCount: 1,
      bookingLink: '/test-user',
    }

    render(createElement(DashboardClient, props))

    const bookingsLink = screen.getByRole('link', { name: 'View bookings' })
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
})
