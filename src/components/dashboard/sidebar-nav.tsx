'use client'

import { usePathname } from 'next/navigation'
import { Plus, Check, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppIcon } from '@/components/shared/app-icon'
import { Button } from '@/components/ui/button'
import { GuardedLink } from '@/components/dashboard/guarded-link'
import {
  dashboardNavigationRoutes,
  isDashboardRouteActive,
} from '@/components/dashboard/dashboard-routes'
import { useBookingLinkAction } from '@/components/dashboard/use-booking-link-action'

interface SidebarNavProps {
  username?: string
}

export function SidebarNav({ username }: SidebarNavProps) {
  const pathname = usePathname()
  const { copied, copyBookingLink, publicBookingUrl } =
    useBookingLinkAction(username)

  return (
    <aside className="flex h-full min-h-0 w-64 flex-col overflow-y-auto border-r bg-card/95">
      {/* Logo */}
      <div className="p-6 pb-4">
        <GuardedLink
          href="/dashboard"
          className="flex items-center text-xl font-bold text-foreground"
        >
          <AppIcon className="mr-2 h-7 w-7" />
          OpenSlot
        </GuardedLink>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-3" aria-label="Dashboard navigation">
        {dashboardNavigationRoutes.map((item) => {
          const isActive = isDashboardRouteActive(pathname, item.href)
          const Icon = item.icon
          return (
            <GuardedLink
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.navigationLabel}
            </GuardedLink>
          )
        })}
      </nav>

      {/* New event type button */}
      <div className="px-3 mb-4">
        <Button asChild className="w-full" size="sm">
          <GuardedLink href="/event-types/new">
            <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
            New event type
          </GuardedLink>
        </Button>
      </div>

      {/* Share your link CTA */}
      <div className="mx-3 mb-4 rounded-lg border border-border bg-accent/40 p-4">
        <p className="text-sm font-medium text-foreground">Share your link</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Copy your public booking page URL.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={() => void copyBookingLink()}
          disabled={!publicBookingUrl}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          ) : (
            <Link2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
    </aside>
  )
}
