'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OpenSlotLogo } from '@/components/brand/openslot-logo'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Use cases', href: '#use-cases' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Docs', href: '#docs' },
]

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 p-2">
      <nav
        className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between rounded-[18px] border border-border bg-white/92 px-5 shadow-sm backdrop-blur sm:px-8"
        aria-label="Main navigation"
      >
        <OpenSlotLogo />

        <div className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-[10px] border border-border bg-white px-5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-accent"
          >
            Log in
          </Link>
          <Button asChild>
            <Link href="/signup">Create your OpenSlot</Link>
          </Button>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="mx-auto mt-2 max-w-[1440px] rounded-[16px] border border-border bg-white p-2 shadow-md md:hidden"
          role="menu"
        >
          <div className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block min-h-[44px] rounded-[10px] px-3 py-2 text-base font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                role="menuitem"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="block min-h-[44px] rounded-[10px] px-3 py-2 text-base font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              role="menuitem"
              onClick={() => setMobileMenuOpen(false)}
            >
              Log In
            </Link>
            <div className="pt-2">
              <Button asChild className="w-full">
                <Link href="/signup">Create your OpenSlot</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
