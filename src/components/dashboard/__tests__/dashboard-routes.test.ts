import { describe, expect, it } from 'vitest'
import {
  dashboardHeaderLabel,
  dashboardNavigationRoutes,
  isDashboardRouteActive,
} from '../dashboard-routes'

describe('dashboard route configuration', () => {
  it('provides the shared desktop and mobile navigation destinations', () => {
    expect(
      dashboardNavigationRoutes.map(({ navigationLabel, href }) => ({
        navigationLabel,
        href,
      }))
    ).toEqual([
      { navigationLabel: 'Overview', href: '/dashboard' },
      { navigationLabel: 'Event Types', href: '/event-types' },
      { navigationLabel: 'Availability', href: '/availability' },
      { navigationLabel: 'Bookings', href: '/bookings' },
      { navigationLabel: 'Contacts', href: '/contacts' },
      { navigationLabel: 'Profile', href: '/profile' },
      { navigationLabel: 'Settings', href: '/settings' },
    ])
  })

  it('matches exact destinations and their owned child routes', () => {
    expect(isDashboardRouteActive('/dashboard', '/dashboard')).toBe(true)
    expect(isDashboardRouteActive('/dashboard/example', '/dashboard')).toBe(
      false
    )
    expect(
      isDashboardRouteActive('/event-types/event-1/edit', '/event-types')
    ).toBe(true)
    expect(isDashboardRouteActive('/settings-old', '/settings')).toBe(false)
  })

  it.each([
    ['/dashboard', 'Dashboard'],
    ['/availability', 'Availability'],
    ['/event-types/new', 'Create event type'],
    ['/event-types/event-1/edit', 'Edit event type'],
    ['/contacts/contact-1', 'Contact details'],
    ['/settings', 'Settings'],
    ['/unknown-dashboard-route', 'Dashboard'],
  ])('labels %s as %s', (pathname, label) => {
    expect(dashboardHeaderLabel(pathname)).toBe(label)
  })
})
