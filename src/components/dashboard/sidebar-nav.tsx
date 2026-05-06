'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Event Types', href: '/event-types' },
  { label: 'Availability', href: '/availability' },
  { label: 'Bookings', href: '/bookings' },
  { label: 'Profile', href: '/profile' },
]

interface SidebarNavProps {
  userName: string
  userEmail: string
}

export function SidebarNav({ userName, userEmail }: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-muted/40">
      <div className="p-6">
        <Link href="/dashboard" className="text-xl font-bold">
          OpenSlot
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-4">
        <div className="mb-3 truncate">
          <p className="text-sm font-medium truncate">{userName || 'User'}</p>
          <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
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
    </aside>
  )
}
