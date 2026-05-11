'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Clock,
  BookOpen,
  Settings,
  Plus,
  Check,
  Link2,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppIcon } from '@/components/shared/app-icon'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { copyTextToClipboard } from '@/lib/utils/clipboard'

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Event Types', href: '/event-types', icon: Calendar },
  { label: 'Availability', href: '/availability', icon: Clock },
  { label: 'Bookings', href: '/bookings', icon: BookOpen },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarNavProps {
  username?: string
}

export function SidebarNav({ username }: SidebarNavProps) {
  const pathname = usePathname()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const publicBookingUrl = useMemo(() => {
    if (!username) return ''

    const normalizedUsername = username.replace(/^\/+/, '')
    const browserOrigin =
      typeof window !== 'undefined' ? window.location.origin : ''
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || ''
    const origin = browserOrigin || configuredOrigin

    return origin
      ? `${origin}/${normalizedUsername}`
      : `/${normalizedUsername}`
  }, [username])

  const handleCopyBookingLink = async () => {
    if (!publicBookingUrl) return

    try {
      await copyTextToClipboard(publicBookingUrl)
      setCopied(true)
      toast({
        title: 'Booking link copied',
        description: 'Your public booking page URL is ready to share.',
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: 'Could not copy link',
        description: 'Copy the link from your profile preview instead.',
        variant: 'destructive',
      })
    }
  }

  return (
    <aside className="flex h-full min-h-0 w-64 flex-col overflow-y-auto border-r bg-card/95">
      {/* Logo */}
      <div className="p-6 pb-4">
        <Link
          href="/dashboard"
          className="flex items-center text-xl font-bold text-foreground"
        >
          <AppIcon className="mr-2 h-7 w-7" />
          OpenSlot
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-3" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))
          const Icon = item.icon
          return (
            <Link
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
      <div className="mx-3 mb-4 rounded-lg border border-border bg-accent/40 p-4">
        <p className="text-sm font-medium text-foreground">Share your link</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Copy your public booking page URL.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={handleCopyBookingLink}
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
