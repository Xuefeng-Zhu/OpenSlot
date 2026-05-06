'use client'

import { useState } from 'react'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { TopBar } from '@/components/dashboard/top-bar'
import { MobileDrawer } from '@/components/shared/mobile-drawer'

interface DashboardShellProps {
  children: React.ReactNode
  user: {
    name: string
    email: string
  }
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar - hidden on mobile/tablet */}
      <div className="hidden lg:flex">
        <SidebarNav user={{ name: user.name, email: user.email }} />
      </div>

      {/* Mobile drawer - visible only on mobile/tablet */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={{ name: user.name, email: user.email }}
      />

      {/* Content area */}
      <div className="flex flex-1 flex-col">
        <TopBar title="Dashboard" onMenuToggle={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
