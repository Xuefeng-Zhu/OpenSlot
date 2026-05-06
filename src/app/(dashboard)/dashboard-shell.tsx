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
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:flex">
        <SidebarNav user={{ name: user.name, email: user.email }} />
      </div>

      {/* Mobile drawer - visible only on mobile/tablet */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={{ name: user.name, email: user.email }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title="Dashboard" onMenuToggle={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  )
}
