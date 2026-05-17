'use client'

import { useState } from 'react'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { TopBar } from '@/components/dashboard/top-bar'
import { MobileDrawer } from '@/components/shared/mobile-drawer'
import {
  emptyDashboardNotifications,
  type DashboardNotifications,
} from '@/lib/dashboard/notifications'

interface DashboardShellProps {
  children: React.ReactNode
  notifications?: DashboardNotifications
  user: {
    name: string
    email: string
    username?: string
  }
}

export function DashboardShell({
  children,
  notifications = emptyDashboardNotifications,
  user,
}: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar - hidden on mobile/tablet */}
      <div className="hidden min-h-0 lg:flex">
        <SidebarNav username={user.username} />
      </div>

      {/* Mobile drawer - visible only on mobile/tablet */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={{ name: user.name, email: user.email }}
      />

      {/* Content area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TopBar
          title="Dashboard"
          notifications={notifications}
          onMenuToggle={() => setDrawerOpen(true)}
          user={{ name: user.name, email: user.email }}
        />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
