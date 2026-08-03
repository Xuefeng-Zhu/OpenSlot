'use client'

import { useRef, useState } from 'react'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { TopBar } from '@/components/dashboard/top-bar'
import { MobileDrawer } from '@/components/shared/mobile-drawer'
import {
  emptyDashboardNotifications,
  type DashboardNotifications,
} from '@/lib/dashboard/notifications'
import { DashboardNavigationGuardProvider } from '@/components/dashboard/navigation-guard-provider'
import { DashboardSignOutProvider } from '@/components/dashboard/dashboard-sign-out-provider'

interface DashboardShellProps {
  children: React.ReactNode
  notifications?: DashboardNotifications
  user: {
    name: string
    email: string
    username?: string
    avatarUrl?: string | null
  }
}

export function DashboardShell({
  children,
  notifications = emptyDashboardNotifications,
  user,
}: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mainRef = useRef<HTMLElement | null>(null)

  return (
    <DashboardNavigationGuardProvider>
      <DashboardSignOutProvider>
        <a
          href="#dashboard-main"
          className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:not-sr-only focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={(event) => {
            event.preventDefault()
            mainRef.current?.focus()
          }}
        >
          Skip to main content
        </a>
        <div
          className="flex h-screen overflow-hidden bg-background"
          data-testid="dashboard-shell"
        >
          {/* Desktop sidebar - hidden on mobile/tablet */}
          <div className="hidden min-h-0 lg:flex">
            <SidebarNav username={user.username} />
          </div>

          {/* Mobile drawer - visible only on mobile/tablet */}
          <MobileDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            user={{
              name: user.name,
              email: user.email,
              username: user.username,
              avatarUrl: user.avatarUrl,
            }}
          />

          {/* Content area */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TopBar
              notifications={notifications}
              onMenuToggle={() => setDrawerOpen(true)}
              user={{
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
              }}
            />
            <main
              id="dashboard-main"
              ref={mainRef}
              tabIndex={-1}
              className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8"
            >
              <div className="mx-auto w-full max-w-7xl">{children}</div>
            </main>
          </div>
        </div>
      </DashboardSignOutProvider>
    </DashboardNavigationGuardProvider>
  )
}
