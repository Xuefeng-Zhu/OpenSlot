'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Grid2X2,
  Calendar,
  Clock,
  BookOpen,
  Settings,
  User,
  Link2,
  Plus,
  ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, getInitials } from '@/components/ui/avatar'
import { OpenSlotLogo } from '@/components/brand/openslot-logo'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: Grid2X2 },
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
    <aside className="flex h-screen w-[280px] flex-col border-r border-border bg-white">
      <div className="p-7 pb-5">
        <OpenSlotLogo href="/dashboard" />
      </div>

      <nav className="flex-1 space-y-2 px-4" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex h-12 items-center gap-4 rounded-[12px] px-4 text-sm font-bold transition-colors',
                isActive
                  ? 'bg-accent text-primary'
                  : 'text-muted-foreground hover:bg-accent/70 hover:text-primary'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute -left-4 top-2 h-8 w-1 rounded-r-full bg-primary" />
              )}
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mx-5 mb-6 rounded-[16px] border border-primary/10 bg-primary/[0.07] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-white text-primary shadow-sm">
            <Link2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-foreground">Share your link</p>
            <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
              Invite clients to book time with you in a few clicks.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
          <Link href="/johndoe" target="_blank">
            View booking page
            <ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="px-5 pb-5">
        <Button className="mb-5 w-full" asChild>
          <Link href="/event-types/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New event type
          </Link>
        </Button>
        <div className="border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-3">
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
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleLogout}
          >
            Log out
          </Button>
        </div>
      </div>
    </aside>
  )
}
