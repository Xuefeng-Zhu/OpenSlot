'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Clock,
  BookOpen,
  Settings,
  Plus,
  ExternalLink,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, getInitials } from '@/components/ui/avatar'

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Event Types', href: '/event-types', icon: Calendar },
  { label: 'Availability', href: '/availability', icon: Clock },
  { label: 'Bookings', href: '/bookings', icon: BookOpen },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarNavUser {
  name?: string
  email?: string
  avatarUrl?: string | null
}

interface SidebarNavProps {
  user?: SidebarNavUser
  /** @deprecated Use `user` prop instead */
  userName?: string
  /** @deprecated Use `user` prop instead */
  userEmail?: string
}

export function SidebarNav({ user, userName, userEmail }: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Support both new `user` prop and legacy individual props
  const displayName = user?.name || userName || ''
  const displayEmail = user?.email || userEmail || ''
  const avatarUrl = user?.avatarUrl || null

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <aside className="flex h-full min-h-0 w-64 flex-col overflow-y-auto border-r bg-card">
      {/* Logo */}
      <div className="p-6 pb-4">
        <Link
          href="/dashboard"
          className="flex items-center text-xl font-bold text-foreground"
        >
          <svg
            className="mr-2 h-7 w-7"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect width="28" height="28" rx="6" className="fill-primary" />
            <path
              d="M8 14.5L12 18.5L20 10.5"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          OpenSlot
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-3" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
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

      {/* New event type button */}
      <div className="px-3 mb-4">
        <Button asChild className="w-full" size="sm">
          <Link href="/event-types/new">
            <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
            New event type
          </Link>
        </Button>
      </div>

      {/* Share your link CTA */}
      <div className="mx-3 mb-4 rounded-lg bg-accent/50 p-4">
        <p className="text-sm font-medium text-foreground">Share your link</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Invite clients to book time with you in just a few clicks.
        </p>
        <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
          <Link href="/dashboard">
            View booking page
            <ExternalLink className="h-3 w-3 ml-1.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>

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
    </aside>
  )
}
