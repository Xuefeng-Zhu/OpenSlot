import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'
import { DashboardShell } from '../dashboard-shell'
import { useDashboardUnsavedChanges } from '@/components/dashboard/navigation-guard-provider'

expect.extend(toHaveNoViolations)

vi.mock('@/components/dashboard/sidebar-nav', () => ({
  SidebarNav: () => <aside data-testid="sidebar-nav" />,
}))

vi.mock('@/components/dashboard/top-bar', () => ({
  TopBar: () => <header data-testid="top-bar" />,
}))

vi.mock('@/components/shared/mobile-drawer', () => ({
  MobileDrawer: () => null,
}))

describe('DashboardShell', () => {
  it('constrains page height and scrolls the content pane', () => {
    const { container } = render(
      <DashboardShell user={{ name: 'Jane Doe', email: 'jane@example.com' }}>
        <section>Scrollable dashboard content</section>
      </DashboardShell>
    )

    const shell = container.firstElementChild
    const main = screen.getByRole('main')
    const contentColumn = main.parentElement
    const sidebarWrapper = screen.getByTestId('sidebar-nav').parentElement

    expect(shell?.classList.contains('h-screen')).toBe(true)
    expect(shell?.classList.contains('overflow-hidden')).toBe(true)
    expect(sidebarWrapper?.classList.contains('min-h-0')).toBe(true)
    expect(contentColumn?.classList.contains('min-h-0')).toBe(true)
    expect(contentColumn?.classList.contains('overflow-hidden')).toBe(true)
    expect(main.classList.contains('min-h-0')).toBe(true)
    expect(main.classList.contains('overflow-y-auto')).toBe(true)
    expect(main.textContent).toContain('Scrollable dashboard content')
  })

  it('mounts the navigation guard around dashboard content', () => {
    function DirtyChild() {
      useDashboardUnsavedChanges('shell-test', true, () => undefined)
      return <section>Dirty dashboard content</section>
    }

    render(
      <DashboardShell user={{ name: 'Jane Doe', email: 'jane@example.com' }}>
        <DirtyChild />
      </DashboardShell>
    )

    const unloadEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unloadEvent)

    expect(unloadEvent.defaultPrevented).toBe(true)
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <DashboardShell user={{ name: 'Jane Doe', email: 'jane@example.com' }}>
        <h1>Dashboard overview</h1>
      </DashboardShell>
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
