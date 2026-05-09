import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SidebarNav } from '../sidebar-nav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

describe('SidebarNav', () => {
  it('keeps desktop sidebar navigation reachable on short viewports without duplicating account identity', () => {
    const { container } = render(
      <SidebarNav />
    )

    const sidebar = container.querySelector('aside')

    expect(sidebar?.classList.contains('min-h-0')).toBe(true)
    expect(sidebar?.classList.contains('overflow-y-auto')).toBe(true)
    expect(screen.getByRole('navigation', { name: 'Dashboard navigation' })).toBeDefined()
    expect(screen.queryByText('Jane Doe')).toBeNull()
    expect(screen.queryByText('jane@example.com')).toBeNull()
  })
})
