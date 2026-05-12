'use client'

import Link from 'next/link'
import { Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, getInitials } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title: string
  onMenuToggle?: () => void
  user?: {
    name?: string
    email?: string
    avatarUrl?: string | null
  }
}

export function TopBar({ title, onMenuToggle, user }: TopBarProps) {
  const displayName = user?.name || 'User'
  const displayEmail = user?.email || 'View profile'

  return (
    <header
      aria-label={`${title} header`}
      className={cn('flex shrink-0 items-center justify-between border-b border-border bg-card px-6 py-3')}
    >
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            aria-label="Toggle menu"
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="text-muted-foreground">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <div className="px-2 py-2 text-sm text-muted-foreground">
              No new notifications.
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/bookings">View bookings</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          asChild
          variant="ghost"
          className="ml-1 h-auto justify-start gap-2 px-2 py-1.5"
        >
          <Link href="/profile" aria-label={`View profile for ${displayName}`}>
            <Avatar
              src={user?.avatarUrl || null}
              alt={displayName}
              fallback={getInitials(displayName)}
              size="sm"
            />
            <span className="hidden max-w-[180px] text-left sm:block">
              <span className="block truncate text-sm font-medium text-foreground">{displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">{displayEmail}</span>
            </span>
          </Link>
        </Button>
      </div>
    </header>
  )
}
