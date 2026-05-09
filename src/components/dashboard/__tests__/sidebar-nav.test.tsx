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
  it('keeps desktop sidebar content reachable on short viewports', () => {
    const { container } = render(
      <SidebarNav user={{ name: 'Jane Doe', email: 'jane@example.com' }} />
    )

    const sidebar = container.querySelector('aside')

    expect(sidebar?.classList.contains('min-h-0')).toBe(true)
    expect(sidebar?.classList.contains('overflow-y-auto')).toBe(true)
    expect(screen.getByRole('navigation', { name: 'Dashboard navigation' })).toBeDefined()
    expect(screen.getByText('Jane Doe')).toBeDefined()
  })
})
