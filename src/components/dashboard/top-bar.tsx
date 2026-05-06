'use client'

import { Bell, Menu, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title: string
  onMenuToggle?: () => void
}

export function TopBar({ title, onMenuToggle }: TopBarProps) {
  return (
    <header className={cn('flex items-center justify-between border-b border-border bg-card px-6 py-4')}>
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
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-48 pl-9 lg:w-64"
            aria-label="Search"
          />
        </div>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}
