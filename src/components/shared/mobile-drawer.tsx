'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Clock,
  BookOpen,
  Settings,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppIcon } from '@/components/shared/app-icon'
import { Drawer } from '@/components/ui/drawer'
import { Avatar, getInitials } from '@/components/ui/avatar'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Event Types', href: '/event-types', icon: Calendar },
  { label: 'Availability', href: '/availability', icon: Clock },
  { label: 'Bookings', href: '/bookings', icon: BookOpen },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Settings', href: '/settings', icon: Settings },
]

interface MobileDrawerUser {
  name?: string
  email?: string
  avatarUrl?: string | null
}

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  user?: MobileDrawerUser
}

export function MobileDrawer({ open, onClose, user }: MobileDrawerProps) {
  const pathname = usePathname()

  const displayName = user?.name || ''
  const displayEmail = user?.email || ''
  const avatarUrl = user?.avatarUrl || null

  return (
    <Drawer open={open} onClose={onClose} title="Navigation menu">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="p-6">
          <Link
            href="/dashboard"
            className="flex items-center text-xl font-bold text-foreground"
            onClick={onClose}
          >
            <AppIcon className="mr-2 h-7 w-7" />
            OpenSlot
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 px-3" aria-label="Mobile navigation">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User Profile Section */}
        <div className="border-t p-4">
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
        </div>
      </div>
    </Drawer>
  )
}
