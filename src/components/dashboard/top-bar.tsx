'use client'

import { Bell, ChevronDown, CircleHelp, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, getInitials } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title: string
  onMenuToggle?: () => void
}

export function TopBar({ title, onMenuToggle }: TopBarProps) {
  return (
    <header className={cn('flex h-[74px] items-center justify-between border-b border-border bg-white px-5 sm:px-8 lg:px-10')}>
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
        <h1 className="sr-only">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="hidden gap-2 text-foreground sm:inline-flex">
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          Help
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="ml-2 hidden items-center gap-3 border-l border-border pl-4 sm:flex">
          <Avatar
            src={null}
            alt="Sarah Chen avatar"
            fallback={getInitials("Sarah Chen")}
            size="sm"
          />
          <div className="leading-tight">
            <p className="text-sm font-extrabold text-foreground">Sarah Chen</p>
            <p className="text-xs font-medium text-muted-foreground">Product Designer</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
    </header>
  )
}
