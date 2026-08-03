'use client'

import { usePathname } from 'next/navigation'
import { Check, Link2, LogOut, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppIcon } from '@/components/shared/app-icon'
import { Drawer } from '@/components/ui/drawer'
import { Avatar, getInitials } from '@/components/ui/avatar'
import { GuardedLink } from '@/components/dashboard/guarded-link'
import { Button } from '@/components/ui/button'
import {
  dashboardNavigationRoutes,
  isDashboardRouteActive,
} from '@/components/dashboard/dashboard-routes'
import { useBookingLinkAction } from '@/components/dashboard/use-booking-link-action'
import { useDashboardSignOut } from '@/components/dashboard/dashboard-sign-out-provider'

interface MobileDrawerUser {
  name?: string
  email?: string
  username?: string
  avatarUrl?: string | null
}

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  user?: MobileDrawerUser
}

export function MobileDrawer({ open, onClose, user }: MobileDrawerProps) {
  const pathname = usePathname()
  const { isSigningOut, signOut } = useDashboardSignOut()
  const { copied, copyBookingLink, publicBookingUrl } =
    useBookingLinkAction(user?.username)

  const displayName = user?.name || ''
  const displayEmail = user?.email || ''
  const avatarUrl = user?.avatarUrl || null

  return (
    <Drawer open={open} onClose={onClose} title="Navigation menu">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Logo */}
        <div className="shrink-0 p-6">
          <GuardedLink
            href="/dashboard"
            className="flex items-center text-xl font-bold text-foreground"
            onNavigationAccepted={onClose}
          >
            <AppIcon className="mr-2 h-7 w-7" />
            OpenSlot
          </GuardedLink>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {/* Navigation Links */}
          <nav className="space-y-1" aria-label="Mobile navigation">
            {dashboardNavigationRoutes.map((item) => {
              const isActive = isDashboardRouteActive(pathname, item.href)
              const Icon = item.icon
              return (
                <GuardedLink
                  key={item.href}
                  href={item.href}
                  onNavigationAccepted={onClose}
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

          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <Button asChild size="sm" className="w-full">
              <GuardedLink
                href="/event-types/new"
                onNavigationAccepted={onClose}
              >
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                New event type
              </GuardedLink>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => void copyBookingLink()}
              disabled={!publicBookingUrl}
            >
              {copied ? (
                <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
              ) : (
                <Link2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy booking link'}
            </Button>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="shrink-0 border-t p-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={avatarUrl}
              alt={displayName || 'User avatar'}
              fallback={getInitials(displayName || 'U')}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {displayName || 'User'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {displayEmail}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full justify-start text-destructive hover:text-destructive"
            onClick={signOut}
            disabled={isSigningOut}
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
