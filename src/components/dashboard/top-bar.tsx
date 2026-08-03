'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, getInitials } from '@/components/ui/avatar'
import { requestJson } from '@/components/dashboard/request-json'
import { useToast } from '@/components/ui/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  emptyDashboardNotifications,
  type DashboardNotifications,
} from '@/lib/dashboard/notifications'
import { cn } from '@/lib/utils'
import { useDashboardDisplayPreferences } from '@/components/dashboard/display-preferences-provider'
import { formatDashboardTimestamp } from '@/lib/dashboard/display-preferences'

interface TopBarProps {
  title: string
  notifications?: DashboardNotifications
  onMenuToggle?: () => void
  user?: {
    name?: string
    email?: string
    avatarUrl?: string | null
  }
}

type MarkNotificationsSeenResponse =
  | {
      success: true
      notificationsSeenAt: string
    }
  | {
      success: false
      error?: string
    }

export function TopBar({
  title,
  notifications = emptyDashboardNotifications,
  onMenuToggle,
  user,
}: TopBarProps) {
  const { toast } = useToast()
  const displayPreferences = useDashboardDisplayPreferences()
  const displayName = user?.name || 'User'
  const displayEmail = user?.email || 'View profile'
  const notificationItems = notifications.items
  const [unseenCount, setUnseenCount] = useState(notifications.unseenCount)
  const [markingRead, setMarkingRead] = useState(false)
  const [markReadError, setMarkReadError] = useState<string | null>(null)

  useEffect(() => {
    setUnseenCount(notifications.unseenCount)
  }, [notifications.unseenCount])

  async function markAllAsRead() {
    if (unseenCount === 0 || markingRead) return

    const previousUnseenCount = unseenCount
    setUnseenCount(0)
    setMarkReadError(null)
    setMarkingRead(true)

    try {
      const result = await requestJson<MarkNotificationsSeenResponse>(
        '/api/notifications/seen',
        { method: 'POST' },
        'Failed to mark notifications as read'
      )

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to mark notifications as read')
      }
    } catch {
      setUnseenCount(previousUnseenCount)
      setMarkReadError('Could not mark as read. Try again.')
      toast({
        title: 'Could not mark notifications as read',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setMarkingRead(false)
    }
  }

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
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                unseenCount > 0
                  ? `Notifications (${unseenCount} unread)`
                  : 'Notifications'
              }
              className="relative text-muted-foreground"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unseenCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                >
                  {unseenCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
              {unseenCount > 0 && (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    void markAllAsRead()
                  }}
                  disabled={markingRead}
                  className="h-7 cursor-pointer px-2 py-1 text-xs font-medium"
                >
                  {markingRead ? 'Marking...' : 'Mark all as read'}
                </DropdownMenuItem>
              )}
            </div>
            {notificationItems.length > 0 ? (
              <div className="max-h-80 overflow-y-auto py-1">
                {notificationItems.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    asChild
                    className="h-auto cursor-pointer items-start px-2 py-2"
                  >
                    <Link href={notification.href} className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">
                        {notification.title}
                      </span>
                      <span className="text-xs leading-5 text-muted-foreground">
                        {notification.description}
                      </span>
                      <time
                        dateTime={notification.occurredAt}
                        suppressHydrationWarning
                        className="text-xs text-muted-foreground"
                      >
                        {formatDashboardTimestamp(
                          notification.occurredAt,
                          displayPreferences
                        )}
                      </time>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
            ) : (
              <div className="px-2 py-2 text-sm text-muted-foreground">
                No recent booking activity.
              </div>
            )}
            {markReadError && (
              <p className="px-2 py-1 text-xs text-destructive" role="alert">
                {markReadError}
              </p>
            )}
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
