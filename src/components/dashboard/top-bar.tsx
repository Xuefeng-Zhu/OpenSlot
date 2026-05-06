'use client'

import { Bell, Menu, Search, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, getInitials } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title: string
  onMenuToggle?: () => void
  user?: {
    name?: string
    avatarUrl?: string | null
  }
}

export function TopBar({ title, onMenuToggle, user }: TopBarProps) {
  const displayName = user?.name || 'User'

  return (
    <header className={cn('flex items-center justify-between border-b border-border bg-card px-6 py-3')}>
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
        <Button variant="ghost" size="icon" aria-label="Help" className="text-muted-foreground">
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Notifications" className="text-muted-foreground">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </Button>
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            3
          </span>
        </div>
        <div className="ml-2 flex items-center gap-2 cursor-pointer">
          <Avatar
            src={user?.avatarUrl || null}
            alt={displayName}
            fallback={getInitials(displayName)}
            size="sm"
          />
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">Product Designer</p>
          </div>
        </div>
      </div>
    </header>
  )
}
