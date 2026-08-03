import {
  BookOpen,
  Calendar,
  Clock,
  LayoutDashboard,
  Settings,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'

interface DashboardHeaderOverride {
  pattern: RegExp
  label: string
}

interface DashboardRouteDefinition {
  href: string
  headerLabel: string
  navigationLabel?: string
  icon?: LucideIcon
  headerOverrides?: readonly DashboardHeaderOverride[]
}

export interface DashboardNavigationRoute {
  href: string
  headerLabel: string
  navigationLabel: string
  icon: LucideIcon
}

/**
 * Single source of truth for dashboard navigation and route-aware shell labels.
 * More-specific child labels live with their parent navigation destination.
 */
export const dashboardRoutes = [
  {
    href: '/dashboard',
    navigationLabel: 'Overview',
    headerLabel: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/event-types',
    navigationLabel: 'Event Types',
    headerLabel: 'Event types',
    icon: Calendar,
    headerOverrides: [
      { pattern: /^\/event-types\/new\/?$/, label: 'Create event type' },
      {
        pattern: /^\/event-types\/[^/]+\/edit\/?$/,
        label: 'Edit event type',
      },
    ],
  },
  {
    href: '/availability',
    navigationLabel: 'Availability',
    headerLabel: 'Availability',
    icon: Clock,
  },
  {
    href: '/bookings',
    navigationLabel: 'Bookings',
    headerLabel: 'Bookings',
    icon: BookOpen,
  },
  {
    href: '/contacts',
    navigationLabel: 'Contacts',
    headerLabel: 'Contacts',
    icon: Users,
    headerOverrides: [
      { pattern: /^\/contacts\/[^/]+\/?$/, label: 'Contact details' },
    ],
  },
  {
    href: '/profile',
    navigationLabel: 'Profile',
    headerLabel: 'Profile',
    icon: User,
  },
  {
    href: '/settings',
    navigationLabel: 'Settings',
    headerLabel: 'Settings',
    icon: Settings,
  },
  {
    href: '/onboarding',
    headerLabel: 'Set up OpenSlot',
  },
] satisfies readonly DashboardRouteDefinition[]

export const dashboardNavigationRoutes: readonly DashboardNavigationRoute[] =
  dashboardRoutes.flatMap((route) =>
    route.navigationLabel && route.icon
      ? [
          {
            href: route.href,
            headerLabel: route.headerLabel,
            navigationLabel: route.navigationLabel,
            icon: route.icon,
          },
        ]
      : []
  )

/** Returns whether a dashboard navigation destination owns the pathname. */
export function isDashboardRouteActive(pathname: string, href: string) {
  const normalizedPathname = normalizePathname(pathname)
  const normalizedHref = normalizePathname(href)

  if (normalizedHref === '/dashboard') {
    return normalizedPathname === normalizedHref
  }

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  )
}

/** Resolves the accessible shell header label for the current dashboard route. */
export function dashboardHeaderLabel(pathname: string) {
  const normalizedPathname = normalizePathname(pathname)

  for (const route of dashboardRoutes) {
    const override = route.headerOverrides?.find(({ pattern }) =>
      pattern.test(normalizedPathname)
    )

    if (override) return override.label

    if (isDashboardRouteActive(normalizedPathname, route.href)) {
      return route.headerLabel
    }
  }

  return 'Dashboard'
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === '/') return pathname || '/dashboard'
  return pathname.replace(/\/+$/, '')
}
